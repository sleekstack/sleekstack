import { Context, Effect, type Schema } from 'effect'
import type { User } from './schemas'

class Users extends Context.Tag('Users')<Users, { readonly find: (id: string) => Schema.Schema.Type<typeof User> }>() {}

/** A Controller-shaped method: one input object, a required service. */
export const GET = (input: {
  readonly params: { readonly id: string }
}): Effect.Effect<Schema.Schema.Type<typeof User>, never, Users> => {
  // `any` in a body is not the written signature's.
  const id: any = input.params.id
  return Effect.map(Users, (users) => users.find(id))
}
