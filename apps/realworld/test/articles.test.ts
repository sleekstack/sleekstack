import { Effect, Layer, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { Articles, articles } from '../server/articles'
import { addComment } from '../server/comments'
import { Db, DbLive } from '../server/db'
import { follow, register, TokenSecret, ViewerLive } from '../server/identity'

// One in-memory database per test, a fixed secret and the test clock.
const run = <A, E>(body: Effect.Effect<A, E, Db | TokenSecret | Articles>) =>
  Effect.runPromise(
    Effect.provide(
      body,
      Layer.mergeAll(Articles.Default, Layer.succeed(TokenSecret, 's'), TestContext.TestContext).pipe(
        Layer.provideMerge(DbLive(':memory:')),
      ),
    ),
  )

/** `effect` as the viewer presenting `token` (anonymous when undefined). */
const as =
  (token: string | undefined) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.provide(effect, ViewerLive(token))
const anon = as(undefined)

const user = (name: string) => register({ username: name, email: `${name}@x.io`, password: 'secret' })
const draft = (title: string, tagList?: ReadonlyArray<string>) => ({ title, description: 'd', body: 'b', tagList })

/** Alice and Bob, signed in. */
const people = Effect.all({
  alice: Effect.map(user('alice'), (u) => as(u.token)),
  bob: Effect.map(user('bob'), (u) => as(u.token)),
})

describe('create, get and update', () => {
  it('creates with a slug from the title, a clean tagList and the author', async () => {
    const article = await run(
      Effect.flatMap(people, ({ alice }) => alice(articles.create(draft('  Héllo, World! ', [' b', 'a', 'b', ' '])))),
    )
    expect(article).toMatchObject({
      slug: 'hello-world',
      title: 'Héllo, World!',
      tagList: ['a', 'b'],
      favorited: false,
      favoritesCount: 0,
      author: { username: 'alice', following: false },
    })
  })

  it('suffixes a colliding slug, and a new title regenerates it', async () => {
    const slugs = await run(
      Effect.gen(function* () {
        const { alice } = yield* people
        const first = yield* alice(articles.create(draft('Same')))
        const second = yield* alice(articles.create(draft('same!')))
        const third = yield* alice(articles.create(draft('Same')))
        const retitled = yield* alice(articles.update(second.slug, { title: 'Other' }))
        const kept = yield* alice(articles.update(third.slug, { title: 'Same' }))
        return [
          first.slug,
          second.slug,
          third.slug,
          retitled.slug,
          kept.slug,
          (yield* anon(articles.get('other'))).slug,
        ]
      }),
    )
    expect(slugs).toEqual(['same', 'same-2', 'same-3', 'other', 'same-3', 'other'])
  })

  it('updates only the given fields and stamps updatedAt', async () => {
    const [before, after] = await run(
      Effect.gen(function* () {
        const { alice } = yield* people
        const before = yield* alice(articles.create(draft('T', ['x'])))
        yield* TestClock.adjust(1000)
        return [before, yield* alice(articles.update('t', { body: 'new' }))] as const
      }),
    )
    expect(after).toEqual({ ...before, body: 'new', updatedAt: new Date(1000).toISOString() })
  })

  it.each([
    [
      'blank fields on create',
      (op: Ops) => op.alice(articles.create({ title: ' ', description: '', body: '' })),
      {
        _tag: 'ValidationError',
        errors: { title: ["can't be blank"], description: ["can't be blank"], body: ["can't be blank"] },
      },
    ],
    [
      'a blank title on update',
      (op: Ops) => op.alice(articles.update('t', { title: '' })),
      { _tag: 'ValidationError', errors: { title: ["can't be blank"] } },
    ],
    ['an update by a non-author', (op: Ops) => op.bob(articles.update('t', { body: 'x' })), { _tag: 'Forbidden' }],
    ['a delete by a non-author', (op: Ops) => op.bob(articles.delete('t')), { _tag: 'Forbidden' }],
    ['an anonymous create', () => anon(articles.create(draft('x'))), { _tag: 'Unauthorized' }],
    ['getting an unknown slug', () => anon(articles.get('nope')), { _tag: 'NotFound', resource: 'article' }],
    ['updating an unknown slug', (op: Ops) => op.alice(articles.update('nope', { body: 'x' })), { _tag: 'NotFound' }],
    ['deleting an unknown slug', (op: Ops) => op.alice(articles.delete('nope')), { _tag: 'NotFound' }],
    ['favoriting an unknown slug', (op: Ops) => op.alice(articles.favorite('nope')), { _tag: 'NotFound' }],
  ])('rejects %s', async (_, op, expected) => {
    const error = await run(
      Effect.gen(function* () {
        const ops = yield* people
        yield* ops.alice(articles.create(draft('T')))
        return yield* Effect.flip(op(ops) as Effect.Effect<unknown, unknown, Db | TokenSecret>)
      }),
    )
    expect(error).toMatchObject(expected)
  })
})

type Ops = Effect.Effect.Success<typeof people>

describe('list and feed', () => {
  /** Alice writes a (tag x) then c (tags x, y); Bob writes b (tag x) between them; Bob favorites c. */
  const seeded = Effect.gen(function* () {
    const ops = yield* people
    yield* ops.alice(articles.create(draft('a', ['x'])))
    yield* TestClock.adjust(1000)
    yield* ops.bob(articles.create(draft('b', ['x'])))
    yield* TestClock.adjust(1000)
    yield* ops.alice(articles.create(draft('c', ['x', 'y'])))
    yield* ops.bob(articles.favorite('c'))
    return ops
  })
  const slugsOf = (list: { articles: ReadonlyArray<{ slug: string }>; articlesCount: number }) => [
    list.articles.map((a) => a.slug),
    list.articlesCount,
  ]

  it.each([
    ['everything, newest first', {}, [['c', 'b', 'a'], 3]],
    ['by tag', { tag: 'y' }, [['c'], 1]],
    ['by author', { author: 'bob' }, [['b'], 1]],
    ['tag, author and favorited combined', { tag: 'x', author: 'alice', favorited: 'bob' }, [['c'], 1]],
    ['an unknown author', { author: 'nobody' }, [[], 0]],
    ['offset past the count', { offset: '10' }, [[], 3]],
    ['an offset beyond SQLite integers', { offset: '1e20' }, [[], 3]],
    ['limit 0, clamped to 1', { limit: 0 }, [['c'], 3]],
    ['a huge limit, clamped to 100', { limit: '100000' }, [['c', 'b', 'a'], 3]],
    ['a negative offset, clamped to 0', { limit: 1, offset: -5 }, [['c'], 3]],
    ['limit and offset paging', { limit: '1', offset: '1' }, [['b'], 3]],
  ])('lists %s', async (_, query, expected) => {
    expect(slugsOf(await run(Effect.zipRight(seeded, anon(articles.list(query)))))).toEqual(expected)
  })

  it('orders articles created at the same instant by id, newest first', async () => {
    const list = await run(
      Effect.gen(function* () {
        const { alice } = yield* people
        for (const t of ['one', 'two', 'three']) yield* alice(articles.create(draft(t)))
        return yield* anon(articles.list({}))
      }),
    )
    expect(slugsOf(list)).toEqual([['three', 'two', 'one'], 3])
  })

  it.each([
    ['limit', { limit: 'ten' }],
    ['offset', { offset: 'x' }],
  ])('rejects a non-numeric %s', async (field, query) => {
    const error = await run(Effect.flip(anon(articles.list(query))))
    expect(error).toMatchObject({ _tag: 'ValidationError', errors: { [field]: ['must be a number'] } })
  })

  it('feeds the authors the viewer follows, and needs a viewer', async () => {
    const [list, error] = await run(
      Effect.gen(function* () {
        const { bob } = yield* seeded
        yield* bob(follow('alice'))
        return [yield* bob(articles.feed({})), yield* Effect.flip(anon(articles.feed({})))] as const
      }),
    )
    expect(slugsOf(list)).toEqual([['c', 'a'], 2])
    expect(list.articles[0]!.author.following).toBe(true)
    expect(error._tag).toBe('Unauthorized')
  })

  it('lists the tags in use, sorted', async () => {
    expect(await run(Effect.zipRight(seeded, articles.tags()))).toEqual(['x', 'y'])
  })

  it('round-trips any tag text through the article, the tags list and the tag filter', async () => {
    const odd = 'a\u001fb,"c"'
    const [article, all, filtered] = await run(
      Effect.gen(function* () {
        const { alice } = yield* people
        const article = yield* alice(articles.create(draft('T', [odd, 'a'])))
        return [article, yield* articles.tags(), yield* anon(articles.list({ tag: odd }))] as const
      }),
    )
    expect(article.tagList).toEqual(['a', odd])
    expect(all).toEqual(['a', odd])
    expect(filtered.articlesCount).toBe(1)
  })
})

describe('favorites and viewer-relative flags', () => {
  it('favorites idempotently with a COUNT-derived count, relative to the viewer', async () => {
    const seen = await run(
      Effect.gen(function* () {
        const { alice, bob } = yield* people
        yield* alice(articles.create(draft('T')))
        const flags = (a: { favorited: boolean; favoritesCount: number; author: { following: boolean } }) => [
          a.favorited,
          a.favoritesCount,
          a.author.following,
        ]
        yield* bob(follow('alice'))
        return [
          flags(yield* bob(articles.favorite('t'))),
          flags(yield* bob(articles.favorite('t'))),
          flags(yield* alice(articles.favorite('t'))),
          flags(yield* anon(articles.get('t'))),
          flags(yield* alice(articles.get('t'))),
          flags(yield* bob(articles.unfavorite('t'))),
          flags(yield* bob(articles.unfavorite('t'))),
        ]
      }),
    )
    expect(seen).toEqual([
      [true, 1, true],
      [true, 1, true],
      [true, 2, false],
      [false, 2, false],
      [true, 2, false],
      [false, 1, true],
      [false, 1, true],
    ])
  })
})

describe('deleteArticle', () => {
  it('cascades to tag links, favorites and comments', async () => {
    const left = await run(
      Effect.gen(function* () {
        const { alice, bob } = yield* people
        yield* alice(articles.create(draft('T', ['x'])))
        yield* bob(articles.favorite('t'))
        yield* bob(addComment('t', { body: 'hi' }))
        yield* alice(articles.delete('t'))
        const db = yield* Db
        const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n
        return {
          articles: count('articles'),
          links: count('article_tags'),
          favorites: count('favorites'),
          comments: count('comments'),
          tags: yield* articles.tags(),
          get: (yield* Effect.flip(anon(articles.get('t'))))._tag,
        }
      }),
    )
    expect(left).toEqual({ articles: 0, links: 0, favorites: 0, comments: 0, tags: [], get: 'NotFound' })
  })
})
