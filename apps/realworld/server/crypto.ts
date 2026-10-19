import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { Clock, Effect, Option, Schema } from 'effect'
import { Unauthorized } from '../src/errors'

const DEV_SECRET = 'conduit-dev-secret'

/** The token secret: `CONDUIT_SECRET`, else a dev default. A production boot without it throws. */
export const conduitSecret = (env: Record<string, string | undefined> = process.env): string => {
  if (env.CONDUIT_SECRET) return env.CONDUIT_SECRET
  if (env.NODE_ENV === 'production') throw new Error('CONDUIT_SECRET must be set in production')
  return DEV_SECRET
}

const KEY_LENGTH = 64

const derive = (password: string, salt: Buffer) =>
  Effect.async<Buffer>((resume) =>
    scrypt(password, salt, KEY_LENGTH, (error, key) => resume(error ? Effect.die(error) : Effect.succeed(key))),
  )

const equal = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b)

/** A salted scrypt hash, stored as `scrypt$<salt>$<key>` (base64). */
export const hashPassword = (password: string) =>
  Effect.gen(function* () {
    const salt = randomBytes(16)
    const key = yield* derive(password, salt)
    return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
  })

/** Whether `password` matches a `hashPassword` result; a malformed hash matches nothing. */
export const verifyPassword = (password: string, stored: string) =>
  Effect.gen(function* () {
    const [scheme, salt, key, ...rest] = stored.split('$')
    if (scheme !== 'scrypt' || !salt || !key || rest.length) return false
    return equal(yield* derive(password, Buffer.from(salt, 'base64')), Buffer.from(key, 'base64'))
  })

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
const HEADER = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
const Claims = Schema.parseJson(Schema.Struct({ sub: Schema.Number, exp: Schema.Number }))

const signature = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('base64url')

/** A JWT (HS256) naming `userId`, valid for 30 days from the Effect `Clock`'s now. */
export const signToken = (secret: string, userId: number) =>
  Effect.map(Clock.currentTimeMillis, (now) => {
    const iat = Math.floor(now / 1000)
    const payload = Buffer.from(JSON.stringify({ sub: userId, iat, exp: iat + TOKEN_TTL_SECONDS })).toString(
      'base64url',
    )
    const data = `${HEADER}.${payload}`
    return `${data}.${signature(secret, data)}`
  })

/** The user id a `signToken` token names; a malformed, tampered or expired token fails with `Unauthorized`. */
export const verifyToken = (secret: string, token: string): Effect.Effect<number, Unauthorized> =>
  Effect.gen(function* () {
    const [header, payload, sig, ...rest] = token.split('.')
    if (header !== HEADER || payload === undefined || sig === undefined || rest.length) return yield* new Unauthorized()
    if (!equal(Buffer.from(sig), Buffer.from(signature(secret, `${header}.${payload}`))))
      return yield* new Unauthorized()
    const claims = Schema.decodeUnknownOption(Claims)(Buffer.from(payload, 'base64url').toString())
    if (Option.isNone(claims) || claims.value.exp * 1000 <= (yield* Clock.currentTimeMillis))
      return yield* new Unauthorized()
    return claims.value.sub
  })
