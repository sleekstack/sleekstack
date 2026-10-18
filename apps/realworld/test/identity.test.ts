import { Effect, Layer, Option, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { Viewer } from '../src/modules/identity'
import { Db, DbLive } from '../server/db'
import {
  currentUser,
  follow,
  login,
  profile,
  register,
  TokenSecret,
  unfollow,
  updateUser,
  ViewerLive,
} from '../server/identity'

const DAY = 24 * 60 * 60 * 1000

// One in-memory database per test, a fixed secret and the test clock.
const run = <A, E>(body: Effect.Effect<A, E, Db | TokenSecret>) =>
  Effect.runPromise(
    Effect.provide(body, Layer.mergeAll(DbLive(':memory:'), Layer.succeed(TokenSecret, 's'), TestContext.TestContext)),
  )

/** `effect` as the viewer presenting `token` (anonymous when undefined). */
const as =
  (token: string | undefined) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.provide(effect, ViewerLive(token))

const failure = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.flip(effect)

const alice = { username: 'alice', email: 'alice@x.io', password: 'secret1' }
const bob = { username: 'bob', email: 'bob@x.io', password: 'secret2' }

describe('register and login', () => {
  it('registers, signs in by email in any case, and the token resolves to the user', async () => {
    const [registered, signedIn, current] = await run(
      Effect.gen(function* () {
        const user = yield* register(alice)
        const again = yield* login({ email: 'ALICE@x.io', password: alice.password })
        return [user, again, yield* as(again.token)(currentUser)] as const
      }),
    )
    expect(registered).toMatchObject({ username: 'alice', email: 'alice@x.io', bio: null, image: null })
    expect(signedIn.username).toBe('alice')
    expect(current).toEqual({ ...signedIn })
  })

  it.each([
    [
      'blank fields',
      { username: ' ', email: '', password: '' },
      { username: ["can't be blank"], email: ["can't be blank"], password: ["can't be blank"] },
    ],
    ['a taken email in another case', { ...bob, email: 'Alice@X.io' }, { email: ['has already been taken'] }],
    ['a taken username in another case', { ...bob, username: 'ALICE' }, { username: ['has already been taken'] }],
  ])('rejects %s with field errors', async (_, input, errors) => {
    const error = await run(Effect.zipRight(register(alice), failure(register(input))))
    expect(error).toMatchObject({ _tag: 'ValidationError', errors })
  })

  it.each([
    [
      'a wrong password',
      { email: alice.email, password: 'nope' },
      { _tag: 'Forbidden', errors: { 'email or password': ['is invalid'] } },
    ],
    [
      'an unknown email',
      { email: 'who@x.io', password: alice.password },
      { _tag: 'Forbidden', errors: { 'email or password': ['is invalid'] } },
    ],
    [
      'blank fields',
      { email: '', password: '' },
      { _tag: 'ValidationError', errors: { email: ["can't be blank"], password: ["can't be blank"] } },
    ],
  ])('refuses a login with %s', async (_, input, expected) => {
    expect(await run(Effect.zipRight(register(alice), failure(login(input))))).toMatchObject(expected)
  })
})

describe('updateUser', () => {
  it('changes only the given fields; an empty password keeps the old one', async () => {
    const [updated, oldPassword] = await run(
      Effect.gen(function* () {
        const { token } = yield* register(alice)
        const updated = yield* as(token)(updateUser({ bio: 'hi', password: '' }))
        return [updated, yield* login({ email: alice.email, password: alice.password })] as const
      }),
    )
    expect(updated).toMatchObject({ username: 'alice', email: 'alice@x.io', bio: 'hi', image: null })
    expect(oldPassword.username).toBe('alice')
  })

  it('sets a new password and lets a user change the case of their own username', async () => {
    const user = await run(
      Effect.gen(function* () {
        const { token } = yield* register(alice)
        yield* as(token)(updateUser({ username: 'Alice', password: 'fresh' }))
        return yield* login({ email: alice.email, password: 'fresh' })
      }),
    )
    expect(user.username).toBe('Alice')
  })

  it.each([
    [
      'a username another user holds',
      { username: 'BOB' },
      { _tag: 'ValidationError', errors: { username: ['has already been taken'] } },
    ],
    ['a blank email', { email: ' ' }, { _tag: 'ValidationError', errors: { email: ["can't be blank"] } }],
  ])('rejects %s', async (_, input, expected) => {
    const error = await run(
      Effect.gen(function* () {
        yield* register(bob)
        const { token } = yield* register(alice)
        return yield* failure(as(token)(updateUser(input)))
      }),
    )
    expect(error).toMatchObject(expected)
  })

  it('needs a signed-in viewer', async () => {
    expect(await run(failure(as(undefined)(updateUser({ bio: 'x' }))))).toMatchObject({ _tag: 'Unauthorized' })
  })
})

describe('profiles and follows', () => {
  it('follows and unfollows idempotently, as the viewer sees it', async () => {
    const seen = await run(
      Effect.gen(function* () {
        yield* register(bob)
        const { token } = yield* register(alice)
        const me = as(token)
        return [
          (yield* as(undefined)(profile('BOB'))).following,
          (yield* me(follow('bob'))).following,
          (yield* me(follow('bob'))).following,
          (yield* me(profile('bob'))).following,
          (yield* me(unfollow('bob'))).following,
          (yield* me(unfollow('bob'))).following,
        ]
      }),
    )
    expect(seen).toEqual([false, true, true, true, false, false])
  })

  it.each([
    ['following yourself', (token: string) => as(token)(follow('alice')), 'ValidationError'],
    ['an unknown username', (token: string) => as(token)(profile('nobody')), 'NotFound'],
    ['following anonymously', () => as(undefined)(follow('alice')), 'Unauthorized'],
  ])('rejects %s', async (_, op, tag) => {
    const error = await run(Effect.flatMap(register(alice), ({ token }) => failure(op(token))))
    expect(error._tag).toBe(tag)
  })
})

describe('Viewer', () => {
  const resolve = (token: string | undefined) => Effect.either(as(token)(Viewer))

  it('resolves a valid token to its user and no token to anonymous', async () => {
    const [signedIn, anonymous] = await run(
      Effect.gen(function* () {
        const { token } = yield* register(alice)
        return [yield* resolve(token), yield* resolve(undefined)] as const
      }),
    )
    expect(signedIn).toMatchObject({ _tag: 'Right', right: Option.some({ id: 1 }) })
    expect(anonymous).toMatchObject({ _tag: 'Right', right: Option.none() })
  })

  it.each([
    ['tampered', (token: string) => Effect.succeed(`${token.slice(0, -2)}xx`)],
    ['expired', (token: string) => Effect.as(TestClock.adjust(30 * DAY), token)],
    [
      'deleted-user',
      (token: string) =>
        Effect.as(
          Effect.map(Db, (db) => db.exec('DELETE FROM users')),
          token,
        ),
    ],
  ])('rejects a %s token as Unauthorized', async (_, spoil) => {
    const result = await run(
      Effect.gen(function* () {
        const { token } = yield* register(alice)
        return yield* resolve(yield* spoil(token))
      }),
    )
    expect(result).toMatchObject({ _tag: 'Left', left: { _tag: 'Unauthorized' } })
  })
})
