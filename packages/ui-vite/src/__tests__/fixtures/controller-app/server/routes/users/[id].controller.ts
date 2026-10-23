import { Effect, type Schema } from 'effect'
import type { Name } from '../../../src/schemas'

export const bodyLimit = 32

export const GET = (input: {
  params: { id: number }
  query?: { tags?: readonly string[]; full?: boolean }
}): Effect.Effect<{ readonly id: number; readonly tags: readonly string[]; readonly full: boolean }> =>
  Effect.succeed({ id: input.params.id, tags: input.query?.tags ?? [], full: input.query?.full ?? false, hidden: 1 })

export const PUT = (input: { params: { id: number }; body: { readonly name: Schema.Schema.Type<typeof Name> } }) =>
  Effect.succeed({ id: input.params.id, name: input.body.name })
