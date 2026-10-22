import { Effect, type Schema } from 'effect'
import type { Forbidden, ValidationError } from '../../../../src/errors'
import type { LoginUser, User } from '../../../../src/modules/identity'
import type { Db } from '../../../db'
import { login, type TokenSecret } from '../../../identity'

/** Signs a user in: the user, token included. */
export const POST = (input: {
  readonly body: { readonly user: Schema.Schema.Type<typeof LoginUser> }
}): Effect.Effect<{ readonly user: Schema.Schema.Type<typeof User> }, ValidationError | Forbidden, Db | TokenSecret> =>
  Effect.map(login(input.body.user), (user) => ({ user }))
