import { Effect, Layer, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { Articles } from '../server/articles'
import { articles } from './articles-effects'
import { addComment, deleteComment, listComments } from '../server/comments'
import { type Db, DbLive } from '../server/db'
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

const user = (name: string) =>
  Effect.map(register({ username: name, email: `${name}@x.io`, password: 'secret' }), (u) => as(u.token))

/** Alice's article `t` and a first comment on it by Bob. */
const seeded = Effect.gen(function* () {
  const alice = yield* user('alice')
  const bob = yield* user('bob')
  yield* alice(articles.create({ title: 'T', description: 'd', body: 'b' }))
  const first = yield* bob(addComment('t', { body: 'first' }))
  return { alice, bob, first }
})

describe('comments', () => {
  it('lists newest first, with following relative to the viewer', async () => {
    const [asAlice, asAnon] = await run(
      Effect.gen(function* () {
        const { alice } = yield* seeded
        yield* TestClock.adjust(1000)
        yield* alice(addComment('t', { body: 'second' }))
        yield* alice(follow('bob'))
        return [yield* alice(listComments('t')), yield* anon(listComments('t'))] as const
      }),
    )
    const view = (list: typeof asAlice) => list.map((c) => [c.body, c.author.username, c.author.following])
    expect(view(asAlice)).toEqual([
      ['second', 'alice', false],
      ['first', 'bob', true],
    ])
    expect(view(asAnon)).toEqual([
      ['second', 'alice', false],
      ['first', 'bob', false],
    ])
  })

  it('lets the author delete their comment', async () => {
    const left = await run(
      Effect.gen(function* () {
        const { bob, first } = yield* seeded
        yield* bob(deleteComment('t', first.id))
        return yield* anon(listComments('t'))
      }),
    )
    expect(left).toEqual([])
  })

  it.each([
    [
      'a blank body',
      (s: Seeded) => s.bob(addComment('t', { body: '  ' })),
      { _tag: 'ValidationError', errors: { body: ["can't be blank"] } },
    ],
    ['an anonymous comment', () => anon(addComment('t', { body: 'x' })), { _tag: 'Unauthorized' }],
    [
      'a comment on an unknown slug',
      (s: Seeded) => s.bob(addComment('nope', { body: 'x' })),
      { _tag: 'NotFound', resource: 'article' },
    ],
    ['listing an unknown slug', () => anon(listComments('nope')), { _tag: 'NotFound', resource: 'article' }],
    // The article's author is not the comment's author.
    ['a delete by a non-author', (s: Seeded) => s.alice(deleteComment('t', s.first.id)), { _tag: 'Forbidden' }],
    [
      'deleting an unknown comment',
      (s: Seeded) => s.bob(deleteComment('t', 999)),
      { _tag: 'NotFound', resource: 'comment' },
    ],
  ])('rejects %s', async (_, op, expected) => {
    const error = await run(
      Effect.flatMap(seeded, (s) => Effect.flip(op(s) as Effect.Effect<unknown, unknown, Db | TokenSecret>)),
    )
    expect(error).toMatchObject(expected)
  })
})

type Seeded = Effect.Effect.Success<typeof seeded>
