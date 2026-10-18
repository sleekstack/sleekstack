import { Context, Effect, Layer, Option } from 'effect'
import { Forbidden, NotFound, Unauthorized, ValidationError } from '../src/errors'
import {
  type LoginUser,
  type NewUser,
  type Profile,
  requireFields,
  type UpdateUser,
  type User,
  Viewer,
} from '../src/modules/identity'
import { conduitSecret, hashPassword, signToken, verifyPassword, verifyToken } from './crypto'
import { Db } from './db'

/** The token signing secret: a server-only service. */
export class TokenSecret extends Context.Tag('realworld/server/TokenSecret')<TokenSecret, string>() {}
export const TokenSecretLive = Layer.sync(TokenSecret, () => conduitSecret())

interface Row {
  readonly id: number
  readonly email: string
  readonly username: string
  readonly password_hash: string
  readonly bio: string | null
  readonly image: string | null
}

const byId = (id: number) =>
  Effect.map(Db, (db) => db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined)
// Email and username columns are NOCASE, so every lookup is case-insensitive.
const byField = (field: 'email' | 'username', value: string) =>
  Effect.map(Db, (db) => db.prepare(`SELECT * FROM users WHERE ${field} = ?`).get(value) as Row | undefined)

const toUser = (row: Row, token: string): User => ({
  email: row.email,
  token,
  username: row.username,
  bio: row.bio,
  image: row.image,
})

const TAKEN = ['has already been taken']

/** `has already been taken` for each of `fields` another user (not `self`) holds. */
const requireFree = (fields: Partial<Record<'email' | 'username', string>>, self?: number) =>
  Effect.gen(function* () {
    const errors: Record<string, ReadonlyArray<string>> = {}
    for (const [field, value] of Object.entries(fields) as Array<['email' | 'username', string]>) {
      const row = yield* byField(field, value)
      if (row && row.id !== self) errors[field] = TAKEN
    }
    if (Object.keys(errors).length) return yield* new ValidationError({ errors })
  })

// A concurrent write can take the email or username between the check and the write; the UNIQUE index catches it.
const write = <A>(f: () => A) =>
  Effect.try({ try: f, catch: (error) => error }).pipe(
    Effect.catchAll((error) => {
      const field = /UNIQUE constraint failed: users\.(email|username)/.exec(String(error))?.[1]
      return field ? Effect.fail(new ValidationError({ errors: { [field]: TAKEN } })) : Effect.die(error)
    }),
  )

const signed = (row: Row) => Effect.flatMap(TokenSecret, (secret) => signToken(secret, row.id))

/** Registers a user and signs them in. */
export const register = (input: NewUser) =>
  Effect.gen(function* () {
    yield* requireFields({ username: input.username, email: input.email, password: input.password })
    const email = input.email.trim()
    const username = input.username.trim()
    yield* requireFree({ email, username })
    const hash = yield* hashPassword(input.password)
    const db = yield* Db
    const { lastInsertRowid } = yield* write(() =>
      db.prepare('INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)').run(email, username, hash),
    )
    const row = (yield* byId(Number(lastInsertRowid)))!
    return toUser(row, yield* signed(row))
  })

const WRONG_LOGIN = new Forbidden({ errors: { 'email or password': ['is invalid'] } })

/** Signs a user in; an unknown email and a wrong password fail alike. */
export const login = (input: LoginUser) =>
  Effect.gen(function* () {
    yield* requireFields({ email: input.email, password: input.password })
    const row = yield* byField('email', input.email.trim())
    // An unknown email still pays for a hash, so timing does not tell which emails exist.
    const ok = row
      ? yield* verifyPassword(input.password, row.password_hash)
      : yield* hashPassword(input.password).pipe(Effect.as(false))
    if (!row || !ok) return yield* WRONG_LOGIN
    return toUser(row, yield* signed(row))
  })

/** The signed-in viewer, or `Unauthorized`. */
export const requireViewer = Effect.flatMap(Viewer, (viewer) =>
  Option.match(viewer, { onNone: () => Effect.fail(new Unauthorized()), onSome: Effect.succeed }),
)

const viewerRow = Effect.gen(function* () {
  const viewer = yield* requireViewer
  const row = yield* byId(viewer.id)
  if (!row) return yield* new Unauthorized()
  return { row, token: viewer.token }
})

/** The signed-in user, with the token they presented. */
export const currentUser = Effect.map(viewerRow, ({ row, token }) => toUser(row, token))

/** Updates the signed-in user's given fields; an absent field or an empty password stays as it is. */
export const updateUser = (input: UpdateUser) =>
  Effect.gen(function* () {
    const { row, token } = yield* viewerRow
    const email = input.email?.trim()
    const username = input.username?.trim()
    yield* requireFields({
      ...(input.email !== undefined && { email }),
      ...(input.username !== undefined && { username }),
      ...(input.password && { password: input.password }),
    })
    yield* requireFree({ ...(email && { email }), ...(username && { username }) }, row.id)
    const changes: Record<string, string | null> = {
      ...(email && { email }),
      ...(username && { username }),
      ...(input.password && { password_hash: yield* hashPassword(input.password) }),
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.image !== undefined && { image: input.image }),
    }
    // Only the given columns are written, so a concurrent update to another field is kept.
    const columns = Object.keys(changes)
    if (columns.length) {
      const db = yield* Db
      yield* write(() =>
        db
          .prepare(`UPDATE users SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
          .run(...Object.values(changes), row.id),
      )
    }
    return toUser((yield* byId(row.id))!, token)
  })

const profileRow = (username: string) =>
  Effect.flatMap(byField('username', username), (row) =>
    row ? Effect.succeed(row) : Effect.fail(new NotFound({ resource: 'profile' })),
  )

const toProfile = (row: Row) =>
  Effect.gen(function* () {
    const viewer = yield* Viewer
    const db = yield* Db
    const following =
      Option.isSome(viewer) &&
      db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND followed_id = ?').get(viewer.value.id, row.id) !==
        undefined
    return { username: row.username, bio: row.bio, image: row.image, following } satisfies Profile
  })

/** `username`'s profile as the viewer sees it. */
export const profile = (username: string) => Effect.flatMap(profileRow(username), toProfile)

/** Follows `username`; following twice is a no-op, following yourself a `ValidationError`. */
export const follow = (username: string) =>
  Effect.gen(function* () {
    const viewer = yield* requireViewer
    const row = yield* profileRow(username)
    if (row.id === viewer.id) return yield* new ValidationError({ errors: { username: ['cannot follow yourself'] } })
    const db = yield* Db
    db.prepare('INSERT OR IGNORE INTO follows (follower_id, followed_id) VALUES (?, ?)').run(viewer.id, row.id)
    return yield* toProfile(row)
  })

/** Unfollows `username`; unfollowing twice is a no-op. */
export const unfollow = (username: string) =>
  Effect.gen(function* () {
    const viewer = yield* requireViewer
    const row = yield* profileRow(username)
    const db = yield* Db
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND followed_id = ?').run(viewer.id, row.id)
    return yield* toProfile(row)
  })

/**
 * The `Viewer` for a request presenting `token`: anonymous without one, `Unauthorized` for a malformed, tampered or
 * expired token, or one naming a user that no longer exists.
 */
export const ViewerLive = (token: string | undefined) =>
  Layer.effect(
    Viewer,
    token === undefined
      ? Effect.succeedNone
      : Effect.gen(function* () {
          const id = yield* verifyToken(yield* TokenSecret, token)
          if (!(yield* byId(id))) return yield* new Unauthorized()
          return Option.some({ id, token })
        }),
  )
