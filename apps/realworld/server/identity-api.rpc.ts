import { Cookies, type Request, type RpcWrap } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { Forbidden, NotFound, Unauthorized, ValidationError } from '../src/errors'
import type { Account, LoginUser, NewUser, Profile, UpdateUser, Viewer } from '../src/modules/identity'
import type { Db } from './db'
import {
  currentUser,
  follow as followUser,
  login as loginUser,
  profile as profileOf,
  register as registerUser,
  type TokenSecret,
  unfollow as unfollowUser,
  updateUser,
} from './identity'
import { asViewer, SESSION, signIn } from './session'

/**
 * Every method runs as the session cookie's viewer; register and login set the session cookie, logout clears it. A
 * stale session cookie reads as anonymous.
 */
export const wrap: RpcWrap = asViewer

/** Registers a user and signs them in on this browser. */
export const register = (
  input: Schema.Schema.Type<typeof NewUser>,
): Effect.Effect<Schema.Schema.Type<typeof Account>, ValidationError, Db | TokenSecret | Cookies | Request> =>
  Effect.flatMap(registerUser(input), signIn)

/** Signs a user in on this browser; an unknown email and a wrong password fail alike. */
export const login = (
  input: Schema.Schema.Type<typeof LoginUser>,
): Effect.Effect<
  Schema.Schema.Type<typeof Account>,
  ValidationError | Forbidden,
  Db | TokenSecret | Cookies | Request
> => Effect.flatMap(loginUser(input), signIn)

/** Signs this browser out: the session cookie is cleared. */
export const logout = (): Effect.Effect<void, never, Cookies> =>
  Effect.flatMap(Cookies, (cookies) => Effect.orDie(cookies.delete(SESSION, { path: '/' })))

/** The signed-in user. */
export const current = (): Effect.Effect<Schema.Schema.Type<typeof Account>, Unauthorized, Db | TokenSecret | Viewer> =>
  currentUser

/** Updates the signed-in user's given fields. */
export const update = (
  input: Schema.Schema.Type<typeof UpdateUser>,
): Effect.Effect<Schema.Schema.Type<typeof Account>, ValidationError | Unauthorized, Db | TokenSecret | Viewer> =>
  updateUser(input)

/** `username`'s profile as the viewer sees it. */
export const profile = (input: {
  readonly username: string
}): Effect.Effect<Schema.Schema.Type<typeof Profile>, Unauthorized | NotFound, Db | TokenSecret | Viewer> =>
  profileOf(input.username)

/** Follows `username`. */
export const follow = (input: {
  readonly username: string
}): Effect.Effect<
  Schema.Schema.Type<typeof Profile>,
  ValidationError | Unauthorized | NotFound,
  Db | TokenSecret | Viewer
> => followUser(input.username)

/** Unfollows `username`. */
export const unfollow = (input: {
  readonly username: string
}): Effect.Effect<Schema.Schema.Type<typeof Profile>, Unauthorized | NotFound, Db | TokenSecret | Viewer> =>
  unfollowUser(input.username)
