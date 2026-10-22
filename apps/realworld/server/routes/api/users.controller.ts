import { ResponseStatus } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { ValidationError } from '../../../src/errors'
import type { NewUser, User } from '../../../src/modules/identity'
import type { Db } from '../../db'
import { register, type TokenSecret } from '../../identity'

/** Registers a user: 201 with the user, token included. */
export const POST = (input: {
  readonly body: { readonly user: Schema.Schema.Type<typeof NewUser> }
}): Effect.Effect<
  { readonly user: Schema.Schema.Type<typeof User> },
  ValidationError,
  Db | TokenSecret | ResponseStatus
> =>
  register(input.body.user).pipe(
    Effect.map((user) => ({ user })),
    Effect.zipLeft(ResponseStatus.set(201)),
  )
