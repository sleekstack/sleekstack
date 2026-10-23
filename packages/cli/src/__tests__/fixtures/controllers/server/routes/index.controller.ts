import { Context, Effect } from 'effect'
import type { Clock } from '../../services'

class Db extends Context.Tag('Db')<Db, { readonly ping: Effect.Effect<string> }>() {}

/** A server-only app: no configureRuntime and no ui tree; its `Clock` comes from a Layer File, its `Db` from nobody. */
export const GET = (): Effect.Effect<string, never, Db | Clock> => Effect.flatMap(Db, (db) => db.ping)
