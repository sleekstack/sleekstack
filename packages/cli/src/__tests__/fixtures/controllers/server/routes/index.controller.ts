import { Context, Effect } from 'effect'

class Db extends Context.Tag('Db')<Db, { readonly ping: Effect.Effect<string> }>() {}

/** A server-only app: no configureRuntime and no ui tree, only this Controller, whose `Db` nobody provides. */
export const GET = (): Effect.Effect<string, never, Db> => Effect.flatMap(Db, (db) => db.ping)
