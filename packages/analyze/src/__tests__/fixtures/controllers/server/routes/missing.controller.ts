import { Effect } from 'effect'
import { Audit, type Clock, Users, Viewer } from '../../services'

export const GET = (): Effect.Effect<void, never, Audit | Users | Clock> => Effect.void // @error MissingDependency
export const POST = (): Effect.Effect<void, never, Viewer> => Effect.void // @error MissingDependency
