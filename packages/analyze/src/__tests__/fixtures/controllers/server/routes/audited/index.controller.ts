import { Effect } from 'effect'
import { Viewer } from '../../../services'

/** Its result's `Viewer` comes from the directory wrap above it. */
export const wrap = (next: Effect.Effect<Response>, _request: Request): Effect.Effect<Response, never, Viewer> =>
  Effect.zipRight(Viewer, next)

export const GET = (): Effect.Effect<void, never, Viewer> => Effect.void
