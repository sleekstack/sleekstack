import { Request } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { Page, User } from '../../../../schemas'
import { Users } from '../../../../services'

/** The named-export form of `twin/class/[id]`. */
export const GET = (input: {
  readonly params: { readonly id: number }
  readonly query: Schema.Schema.Type<typeof Page>
}): Effect.Effect<Schema.Schema.Type<typeof User>, never, Users | Request> =>
  Effect.gen(function* () {
    const users = yield* Users
    yield* Request
    return { name: users.name(input.params.id) }
  })

export const DELETE = (input: { readonly params: { readonly id: number } }): Effect.Effect<void> =>
  Effect.log(input.params.id)
