import { Context, Effect, type Schema } from 'effect'
import type { User } from './schemas'

class Users extends Context.Tag('Users')<Users, { readonly find: (id: string) => Schema.Schema.Type<typeof User> }>() {}

/** A Controller-shaped method: one input object, a required service. */
export const GET = (input: {
  readonly params: { readonly id: string }
}): Effect.Effect<Schema.Schema.Type<typeof User>, never, Users> =>
  Effect.map(Users, (users) => users.find(input.params.id))
