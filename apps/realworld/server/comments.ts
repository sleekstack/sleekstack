import { Effect } from 'effect'
import { Forbidden, NotFound, requireFields } from '../src/errors'
import type { Comment, NewComment } from '../src/modules/comments'
import { Articles, now, viewerId } from './articles'
import { Db } from './db'
import { requireViewer } from './identity'

interface Row {
  readonly id: number
  readonly body: string
  readonly created_at: string
  readonly updated_at: string
  readonly username: string
  readonly bio: string | null
  readonly image: string | null
  readonly following: number
}

// Every comment read, with the `$viewer`-relative `following` flag on its author.
const SELECT = `
SELECT c.*, u.username, u.bio, u.image,
  EXISTS (SELECT 1 FROM follows w WHERE w.followed_id = c.author_id AND w.follower_id = $viewer) AS following
FROM comments c JOIN users u ON u.id = c.author_id`

const toComment = (row: Row): Comment => ({
  id: row.id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  body: row.body,
  author: { username: row.username, bio: row.bio, image: row.image, following: row.following === 1 },
})

/** The comments on the article at `slug`, newest first. */
export const listComments = (slug: string) =>
  Effect.gen(function* () {
    const articles = yield* Articles
    const { id } = yield* articles.at(slug)
    const db = yield* Db
    const rows = db
      .prepare(`${SELECT} WHERE c.article_id = $article ORDER BY c.created_at DESC, c.id DESC`)
      .all({ viewer: yield* viewerId, article: id }) as unknown as Row[]
    return rows.map(toComment)
  })

/** Adds the signed-in viewer's comment to the article at `slug`. */
export const addComment = (slug: string, input: NewComment) =>
  Effect.gen(function* () {
    const viewer = yield* requireViewer
    yield* requireFields({ body: input.body })
    const articles = yield* Articles
    const { id } = yield* articles.at(slug)
    const db = yield* Db
    const at = yield* now
    const { lastInsertRowid } = db
      .prepare('INSERT INTO comments (article_id, author_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, viewer.id, input.body, at, at)
    const row = db
      .prepare(`${SELECT} WHERE c.id = $id`)
      .get({ viewer: viewer.id, id: lastInsertRowid }) as unknown as Row
    return toComment(row)
  })

/** Deletes the viewer's own comment `commentId` on the article at `slug`. */
export const deleteComment = (slug: string, commentId: number) =>
  Effect.gen(function* () {
    const viewer = yield* requireViewer
    const articles = yield* Articles
    const article = yield* articles.at(slug)
    const db = yield* Db
    const row = db
      .prepare('SELECT author_id FROM comments WHERE id = ? AND article_id = ?')
      .get(commentId, article.id) as { author_id: number } | undefined
    if (!row) return yield* new NotFound({ resource: 'comment' })
    if (row.author_id !== viewer.id) return yield* new Forbidden({ errors: { comment: ['is not yours'] } })
    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId)
  })
