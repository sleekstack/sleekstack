import { layer, module, tag, withCleanup } from '@sleekstack/kit'

interface Db { query(sql: string): Promise<unknown[]>; close(): Promise<void> }
interface Tx { run(sql: string): Promise<unknown[]> }
const Db = tag<Db>('Db')
const Tx = tag<Tx>('Tx')

// app: built once, closed when the app scope closes.
const DbLive = layer(Db, () => {
  const db: Db = { query: async () => [], close: async () => {} }
  return withCleanup(db, () => db.close())
})

// request: a fresh instance per action/query call. It may depend on app services,
// never the other way round (that is a CaptiveDependency).
const TxLive = layer(Tx, (db) => ({ run: (sql) => db.query(sql) }), [Db], { lifetime: 'request' })

export const DataModule = module({ name: 'data', provide: [DbLive, TxLive] })
