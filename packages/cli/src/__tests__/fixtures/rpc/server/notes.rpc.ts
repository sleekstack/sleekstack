import { Effect } from 'effect'

export const count = (): Effect.Effect<number> => Effect.succeed(0)
export const loose = (x: any): Effect.Effect<void> => Effect.log(x)
