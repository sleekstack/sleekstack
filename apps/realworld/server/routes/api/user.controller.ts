import { Effect, type Schema } from 'effect'
import type { Unauthorized, ValidationError } from '../../../src/errors'
import type { UpdateUser, User, Viewer } from '../../../src/modules/identity'
import type { Db } from '../../db'
import { currentUser, updateUser } from '../../identity'

type Answer = { readonly user: Schema.Schema.Type<typeof User> }

/** The signed-in user, with the token they presented. */
export const GET = (): Effect.Effect<Answer, Unauthorized, Db | Viewer> => Effect.map(currentUser, (user) => ({ user }))

/** Updates the signed-in user's given fields. */
export const PUT = (input: {
  readonly body: { readonly user: Schema.Schema.Type<typeof UpdateUser> }
}): Effect.Effect<Answer, Unauthorized | ValidationError, Db | Viewer> =>
  Effect.map(updateUser(input.body.user), (user) => ({ user }))
