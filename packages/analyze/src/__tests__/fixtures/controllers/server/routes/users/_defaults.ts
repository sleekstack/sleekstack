import { Effect } from 'effect'
import { Viewer } from '../../../services'

/** Discharges `Viewer` for every Controller under `users/`. */
export const wrap = (next: Effect.Effect<Response, unknown, Viewer>, _request: Request): Effect.Effect<Response, unknown> =>
  Effect.provideService(next, Viewer, { id: 'v' })
