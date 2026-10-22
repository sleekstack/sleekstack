import { Request } from '@sleekstack/start'
import { Effect, type Schema } from 'effect'
import type { Id, Page, Params, User } from '../../../schemas'
import { Users, Viewer } from '../../../services'

type Body = Schema.Schema.Type<typeof User>

/** Printed params; a referenced query; `Users` from start's layer, `Viewer` from the wrap, `Request` per call. */
export const GET = (input: {
  readonly params: { readonly id: number }
  readonly query: Schema.Schema.Type<typeof Page>
}): Effect.Effect<Body, never, Users | Viewer | Request> =>
  Effect.gen(function* () {
    const users = yield* Users
    yield* Viewer
    yield* Request
    return { name: users.name(input.params.id) }
  })

/** Referenced params and body; no written return type, so no success Schema; an error that is no tagged class. */
export const PUT = (input: { readonly params: Schema.Schema.Type<typeof Params>; readonly body: Body }) =>
  Effect.fail(input.body.name)

/** A referenced params value and printed query values. */
export function PATCH(input: {
  readonly params: { readonly id: Schema.Schema.Type<typeof Id> }
  readonly query: { readonly dry?: boolean; readonly ids: readonly number[] }
}): Effect.Effect<void> {
  return Effect.log(input.params.id)
}

/** Neither a method nor an option export: not served, not reported. */
export const helper = 1
export type Patch = string
