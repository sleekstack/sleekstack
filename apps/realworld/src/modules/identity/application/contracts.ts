import { Schema } from 'effect'
import { Forbidden, NotFound, Unauthorized, ValidationError } from '../../../errors'
import { LoginUser, NewUser, Profile, UpdateUser, User } from '../domain/model'

// The client-safe halves of the identity server functions: ids and Schemas, built into functions by `server/app.ts`.

/** The signed-in user as a server function returns it: the token stays in its `HttpOnly` cookie, out of reach of scripts. */
export const Account = User.omit('token')
export type Account = typeof Account.Type

const ByUsername = Schema.Struct({ username: Schema.String })

/** Registers and signs in: sets the session cookie. */
export const registerContract = { id: 'users.register', input: NewUser, success: Account, error: ValidationError }

/** Signs in: sets the session cookie. */
export const loginContract = {
  id: 'users.login',
  input: LoginUser,
  success: Account,
  error: Schema.Union(ValidationError, Forbidden),
}

/** Signs out: clears the session cookie. */
export const logoutContract = { id: 'users.logout', input: Schema.Void, success: Schema.Void }

export const currentUserContract = { id: 'user.current', input: Schema.Void, success: Account, error: Unauthorized }

export const updateUserContract = {
  id: 'user.update',
  input: UpdateUser,
  success: Account,
  error: Schema.Union(ValidationError, Unauthorized),
}

export const profileContract = {
  id: 'profiles.get',
  input: ByUsername,
  success: Profile,
  error: Schema.Union(Unauthorized, NotFound),
}

export const followContract = {
  id: 'profiles.follow',
  input: ByUsername,
  success: Profile,
  error: Schema.Union(ValidationError, Unauthorized, NotFound),
}

export const unfollowContract = {
  id: 'profiles.unfollow',
  input: ByUsername,
  success: Profile,
  error: Schema.Union(Unauthorized, NotFound),
}
