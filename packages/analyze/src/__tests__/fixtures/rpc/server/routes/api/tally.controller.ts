import { Effect } from 'effect'
import { TallyLimit } from '../../../schemas'

export const GET = (): Effect.Effect<number> => Effect.succeed(0)
export const POST = (input: { readonly body: { readonly by: number } }): Effect.Effect<number, TallyLimit> =>
  input.body.by > 10 ? Effect.fail(new TallyLimit({ limit: 10 })) : Effect.succeed(input.body.by)
export const PUT = (input: any): Effect.Effect<void> => Effect.log(input)
