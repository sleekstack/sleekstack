import { Effect } from 'effect'
import { TallyLimit } from '../../../src/pages/tally'

/** REST answers a `TallyLimit` as 409 `{ limit }`; any other failure goes on to `start`. */
export const wrap = (next: Effect.Effect<Response, unknown>): Effect.Effect<Response, unknown> =>
  Effect.catchIf(
    next,
    (e): e is TallyLimit => e instanceof TallyLimit,
    ({ limit }) => Effect.succeed(Response.json({ limit }, { status: 409 })),
  )
