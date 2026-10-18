import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'

class Db extends Context.Tag('Db')<Db, { query(sql: string): Promise<unknown[]> }>() {}
class Tx extends Context.Tag('Tx')<Tx, { run(sql: string): Promise<unknown[]> }>() {}

// app: built once, closed when the app scope closes. The release runs on close.
const DbLive = declareLayer(
  Layer.scoped(
    Db,
    Effect.acquireRelease(Effect.succeed({ query: async () => [] as unknown[] }), () => Effect.logDebug('db closed')),
  ),
)

// request: a fresh instance per request scope. It may depend on app services,
// never the other way round (that is a CaptiveDependency).
const TxLive = declareLayer(
  Layer.effect(
    Tx,
    Effect.map(Db, (db) => ({ run: (sql: string) => db.query(sql) })),
  ),
  { lifetime: 'request' },
)

export const DataModule = module({ name: 'data', entries: [DbLive, TxLive] })
