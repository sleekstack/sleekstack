import type { DatabaseSync } from 'node:sqlite'
import { Clock, Effect, Option } from 'effect'
import { Forbidden, NotFound, ValidationError } from '../src/errors'
import type { Article, ArticleList, ArticleQuery, NewArticle, Page, UpdateArticle } from '../src/modules/articles'
import { requireFields, Viewer } from '../src/modules/identity'
import { Db } from './db'
import { requireViewer } from './identity'

interface Row {
  readonly id: number
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly body: string
  readonly created_at: string
  readonly updated_at: string
  readonly tags: string
  readonly favorited: number
  readonly favorites_count: number
  readonly username: string
  readonly bio: string | null
  readonly image: string | null
  readonly following: number
}

/** The viewer's id for SQL, or null (which matches no favorite or follow) when anonymous. */
export const viewerId = Effect.map(Viewer, (viewer) => Option.getOrNull(Option.map(viewer, (v) => v.id)))

// Every article read: tags, the COUNT-derived favorites, and the `$viewer`-relative flags.
const SELECT = `
SELECT a.*, u.username, u.bio, u.image,
  (SELECT json_group_array(t.name) FROM article_tags at JOIN tags t ON t.id = at.tag_id
    WHERE at.article_id = a.id) AS tags,
  (SELECT COUNT(*) FROM favorites f WHERE f.article_id = a.id) AS favorites_count,
  EXISTS (SELECT 1 FROM favorites f WHERE f.article_id = a.id AND f.user_id = $viewer) AS favorited,
  EXISTS (SELECT 1 FROM follows w WHERE w.followed_id = a.author_id AND w.follower_id = $viewer) AS following
FROM articles a JOIN users u ON u.id = a.author_id`
const ORDER = 'ORDER BY a.created_at DESC, a.id DESC'

const toArticle = (row: Row): Article => ({
  slug: row.slug,
  title: row.title,
  description: row.description,
  body: row.body,
  tagList: (JSON.parse(row.tags) as string[]).sort(),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  favorited: row.favorited === 1,
  favoritesCount: row.favorites_count,
  author: { username: row.username, bio: row.bio, image: row.image, following: row.following === 1 },
})

/** The article at `slug` as the viewer sees it, or `NotFound`. */
export const getArticle = (slug: string) =>
  Effect.gen(function* () {
    const db = yield* Db
    const row = db.prepare(`${SELECT} WHERE a.slug = $slug`).get({ viewer: yield* viewerId, slug }) as Row | undefined
    return row ? toArticle(row) : yield* new NotFound({ resource: 'article' })
  })

/** The id and author of the article at `slug`, or `NotFound`. */
export const articleAt = (slug: string) =>
  Effect.flatMap(Db, (db) => {
    const row = db.prepare('SELECT id, author_id FROM articles WHERE slug = ?').get(slug) as
      { id: number; author_id: number } | undefined
    return row ? Effect.succeed(row) : Effect.fail(new NotFound({ resource: 'article' }))
  })

/** The article at `slug`, if the viewer wrote it: `Forbidden` otherwise. */
const owned = (slug: string) =>
  Effect.gen(function* () {
    const viewer = yield* requireViewer
    const row = yield* articleAt(slug)
    if (row.author_id !== viewer.id) return yield* new Forbidden({ errors: { article: ['is not yours'] } })
    return row
  })

const param = (name: 'limit' | 'offset', value: string | number | undefined, fallback: number) =>
  Effect.gen(function* () {
    if (value === undefined || value === '') return fallback
    const n = typeof value === 'number' ? value : value.trim() === '' ? Number.NaN : Number(value)
    if (!Number.isFinite(n)) return yield* new ValidationError({ errors: { [name]: ['must be a number'] } })
    return Math.floor(n)
  })

/** `limit` (default 20, clamped to [1, 100]) and `offset` (default 0, clamped to [0, a SQLite integer]); non-numeric fails per field. */
const paging = (page: Page) =>
  Effect.all({ limit: param('limit', page.limit, 20), offset: param('offset', page.offset, 0) }).pipe(
    Effect.map(({ limit, offset }) => ({
      limit: Math.min(100, Math.max(1, limit)),
      offset: Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, offset)),
    })),
  )

/** The page of articles matching every `where` clause, newest first, with the total match. */
const page = (where: ReadonlyArray<string>, params: Record<string, string | number>, query: Page) =>
  Effect.gen(function* () {
    const { limit, offset } = yield* paging(query)
    const db = yield* Db
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const rows = db
      .prepare(`${SELECT} ${clause} ${ORDER} LIMIT $limit OFFSET $offset`)
      .all({ ...params, viewer: yield* viewerId, limit, offset }) as unknown as Row[]
    const { n } = db
      .prepare(`SELECT COUNT(*) AS n FROM articles a JOIN users u ON u.id = a.author_id ${clause}`)
      .get(params) as { n: number }
    return { articles: rows.map(toArticle), articlesCount: n } satisfies ArticleList
  })

/** Articles filtered by tag, author and favoriting user (combined), newest first. */
export const listArticles = (query: ArticleQuery) => {
  const where: string[] = []
  const params: Record<string, string> = {}
  if (query.tag !== undefined) {
    where.push(
      'EXISTS (SELECT 1 FROM article_tags at JOIN tags t ON t.id = at.tag_id WHERE at.article_id = a.id AND t.name = $tag)',
    )
    params.tag = query.tag
  }
  if (query.author !== undefined) {
    where.push('u.username = $author')
    params.author = query.author
  }
  if (query.favorited !== undefined) {
    where.push(
      'EXISTS (SELECT 1 FROM favorites f JOIN users fu ON fu.id = f.user_id WHERE f.article_id = a.id AND fu.username = $favorited)',
    )
    params.favorited = query.favorited
  }
  return page(where, params, query)
}

/** Articles by the authors the signed-in viewer follows, newest first. */
export const feed = (query: Page) =>
  Effect.flatMap(requireViewer, (viewer) =>
    page(
      ['a.author_id IN (SELECT followed_id FROM follows WHERE follower_id = $follower)'],
      { follower: viewer.id },
      query,
    ),
  )

/** Every tag in use, sorted. */
export const tags = Effect.map(Db, (db) =>
  (
    db
      .prepare('SELECT DISTINCT t.name FROM tags t JOIN article_tags at ON at.tag_id = t.id ORDER BY t.name')
      .all() as Array<{ name: string }>
  ).map((r) => r.name),
)

const slugify = (title: string) =>
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'article'

// `/api/articles/feed` is the feed, so no article may take that slug.
const RESERVED_SLUGS = new Set(['feed'])

/**
 * Runs `write` with the first free slug for `title` (`x`, `x-2`, `x-3`, ...); the UNIQUE index decides "free", and a
 * reserved slug is never free.
 */
const withSlug = (title: string, write: (slug: string) => void) => {
  const base = slugify(title)
  for (let n = RESERVED_SLUGS.has(base) ? 2 : 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    try {
      write(slug)
      return slug
    } catch (error) {
      if (!/UNIQUE constraint failed: articles\.slug/.test(String(error))) throw error
    }
  }
}

/** Trimmed, deduped, sorted; blank tags dropped. */
const cleanTags = (tagList: ReadonlyArray<string>) => [...new Set(tagList.map((t) => t.trim()).filter(Boolean))].sort()

const setTags = (db: DatabaseSync, articleId: number, tagList: ReadonlyArray<string>) => {
  db.prepare('DELETE FROM article_tags WHERE article_id = ?').run(articleId)
  for (const name of cleanTags(tagList)) {
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name)
    db.prepare('INSERT INTO article_tags (article_id, tag_id) SELECT ?, id FROM tags WHERE name = ?').run(
      articleId,
      name,
    )
  }
}

/** Runs `f` in one transaction, rolled back if it throws. */
const transaction = <A>(db: DatabaseSync, f: () => A) =>
  Effect.sync(() => {
    db.exec('BEGIN')
    try {
      const result = f()
      db.exec('COMMIT')
      return result
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  })

const now = Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())

/** Publishes an article by the signed-in viewer, under a slug made unique from its title. */
export const createArticle = (input: NewArticle) =>
  Effect.gen(function* () {
    const viewer = yield* requireViewer
    yield* requireFields({ title: input.title, description: input.description, body: input.body })
    const db = yield* Db
    const at = yield* now
    const slug = yield* transaction(db, () => {
      let id = 0
      const slug = withSlug(input.title, (slug) => {
        id = Number(
          db
            .prepare(
              'INSERT INTO articles (slug, title, description, body, author_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            )
            .run(slug, input.title.trim(), input.description, input.body, viewer.id, at, at).lastInsertRowid,
        )
      })
      setTags(db, id, input.tagList ?? [])
      return slug
    })
    return yield* getArticle(slug)
  })

/** Updates the given fields of the viewer's own article; a new title gives a new slug, returned in the article. */
export const updateArticle = (slug: string, input: UpdateArticle) =>
  Effect.gen(function* () {
    const { id } = yield* owned(slug)
    yield* requireFields({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.body !== undefined && { body: input.body }),
    })
    const db = yield* Db
    const at = yield* now
    // Only the given columns are written, so a concurrent update to another field is kept.
    const changes: Record<string, string> = {
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.body !== undefined && { body: input.body }),
      updated_at: at,
    }
    const current = db.prepare('SELECT title FROM articles WHERE id = ?').get(id) as { title: string }
    const columns = Object.keys(changes)
    const next = yield* transaction(db, () => {
      db.prepare(`UPDATE articles SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
        ...Object.values(changes),
        id,
      )
      if (input.tagList !== undefined) setTags(db, id, input.tagList)
      return changes.title !== undefined && changes.title !== current.title
        ? withSlug(changes.title, (s) => db.prepare('UPDATE articles SET slug = ? WHERE id = ?').run(s, id))
        : slug
    })
    return yield* getArticle(next)
  })

/** Deletes the viewer's own article with its tags links, favorites and comments. */
export const deleteArticle = (slug: string) =>
  Effect.gen(function* () {
    const { id } = yield* owned(slug)
    const db = yield* Db
    db.prepare('DELETE FROM articles WHERE id = ?').run(id)
  })

/** Favorites the article at `slug`; favoriting twice is a no-op. */
export const favorite = (slug: string) =>
  Effect.gen(function* () {
    const viewer = yield* requireViewer
    const { id } = yield* articleAt(slug)
    const db = yield* Db
    db.prepare('INSERT OR IGNORE INTO favorites (user_id, article_id) VALUES (?, ?)').run(viewer.id, id)
    return yield* getArticle(slug)
  })

/** Unfavorites the article at `slug`; unfavoriting twice is a no-op. */
export const unfavorite = (slug: string) =>
  Effect.gen(function* () {
    const viewer = yield* requireViewer
    const { id } = yield* articleAt(slug)
    const db = yield* Db
    db.prepare('DELETE FROM favorites WHERE user_id = ? AND article_id = ?').run(viewer.id, id)
    return yield* getArticle(slug)
  })
