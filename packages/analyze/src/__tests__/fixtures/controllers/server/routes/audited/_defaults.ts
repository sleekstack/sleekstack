import { Effect } from 'effect'
import { Audit, type Clock, Users, Viewer } from '../../../services'

/** Discharges `Viewer`, yet its result requires `Audit`, which nothing provides, `Users`, which `start` provides, and `Clock`, which a Layer File provides. */
export const wrap = (next: Effect.Effect<Response, unknown, Viewer>, _request: Request): Effect.Effect<Response, unknown, Audit | Users | Clock> => Effect.zipRight(Effect.zipRight(Audit, Users), Effect.provideService(next, Viewer, { id: 'v' })) // @error MissingDependency
