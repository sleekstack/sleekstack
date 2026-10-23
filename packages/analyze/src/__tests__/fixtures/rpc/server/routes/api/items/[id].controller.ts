import { Effect } from 'effect'

export const GET = (input: { readonly params: { readonly id: number } }): Effect.Effect<number> => Effect.succeed(input.params.id)
