import { Controller, type Gen as Returns, Request } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { Page, User } from '../../../../schemas'
import { Users } from '../../../../services'

/** The class form of `twin/named/[id]`: the same methods, schemas and `requires`; `Gen` read through an aliased import. */
export default class extends Controller({ users: Users }) {
  *GET(input: {
    readonly params: { readonly id: number }
    readonly query: Schema.Schema.Type<typeof Page>
  }): Returns<Schema.Schema.Type<typeof User>, never, Users | Request> {
    const users = yield* Users
    yield* Request
    return { name: users.name(input.params.id) }
  }

  *DELETE(input: { readonly params: { readonly id: number } }): Returns<void> {
    yield* Effect.log(this.users.name(input.params.id))
  }

  /** Not HTTP-named: a helper, not served. */
  *helper(): Returns<number> {
    return 1
  }
}

/** An option export beside the class is not a method. */
export const bodyLimit = 1024
