import { Effect } from 'effect'
import { Audit, Users, Viewer } from '../../../services'

/** Discharges `Viewer`, yet its result requires `Audit`, which nothing provides, and `Users`, which `start` provides. */
export const wrap = (next: Effect.Effect<Response, unknown, Viewer>, _request: Request): Effect.Effect<Response, unknown, Audit | Users> => Effect.zipRight(Effect.zipRight(Audit, Users), Effect.provideService(next, Viewer, { id: 'v' })) // @error MissingDependency
