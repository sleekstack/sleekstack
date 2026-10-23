import { Effect } from 'effect' // @error RpcNameCollision

export const now = (): Effect.Effect<number> => Effect.succeed(0)
