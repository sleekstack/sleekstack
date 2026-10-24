import { Effect } from 'effect'

export const service = 'Journal' // @error RpcNameCollision
export const read = (): Effect.Effect<string> => Effect.succeed('')
