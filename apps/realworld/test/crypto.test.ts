import { Effect, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { conduitSecret, hashPassword, signToken, verifyPassword, verifyToken } from '../server/crypto'

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(Effect.provide(effect, TestContext.TestContext))
const DAY = 24 * 60 * 60 * 1000

describe('passwords', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await run(hashPassword('secret123'))
    expect(await run(verifyPassword('secret123', stored))).toBe(true)
    expect(await run(verifyPassword('secret124', stored))).toBe(false)
  })
})

describe('tokens', () => {
  const verify = (token: string, secret = 's') => run(Effect.either(verifyToken(secret, token)))
  const rejected = { _tag: 'Left', left: expect.objectContaining({ _tag: 'Unauthorized' }) }

  it('names the user it was signed for', async () => {
    expect(await verify(await run(signToken('s', 7)))).toMatchObject({ _tag: 'Right', right: 7 })
  })

  it('rejects a tampered payload, another secret and garbage', async () => {
    const [header, payload, sig] = (await run(signToken('s', 7))).split('.')
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), sub: 8 }),
    ).toString('base64url')
    expect(await verify(`${header}.${forged}.${sig}`)).toMatchObject(rejected)
    expect(await verify(`${header}.${payload}.${sig}`, 'other')).toMatchObject(rejected)
    expect(await verify('not-a-token')).toMatchObject(rejected)
  })

  it('rejects a token once it expires, on the injected clock', async () => {
    const result = await run(
      Effect.gen(function* () {
        const token = yield* signToken('s', 7)
        yield* TestClock.adjust(30 * DAY - 1000)
        const fresh = yield* Effect.either(verifyToken('s', token))
        yield* TestClock.adjust(1000)
        return [fresh._tag, (yield* Effect.either(verifyToken('s', token)))._tag]
      }),
    )
    expect(result).toEqual(['Right', 'Left'])
  })
})

describe('conduitSecret', () => {
  it('reads CONDUIT_SECRET, falls back in development and throws on a production boot without it', () => {
    expect(conduitSecret({ CONDUIT_SECRET: 'x', NODE_ENV: 'production' })).toBe('x')
    expect(conduitSecret({})).toBeTruthy()
    expect(() => conduitSecret({ NODE_ENV: 'production' })).toThrow(/CONDUIT_SECRET/)
  })
})
