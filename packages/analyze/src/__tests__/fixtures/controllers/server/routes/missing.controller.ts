import { Effect } from 'effect'
import { Audit, Users, Viewer } from '../../services'

export const GET = (): Effect.Effect<void, never, Audit | Users> => Effect.void // @error MissingDependency
export const POST = (): Effect.Effect<void, never, Viewer> => Effect.void // @error MissingDependency
