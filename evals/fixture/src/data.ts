import { layer, module, tag } from '@sleekstack/kit'

export const Clock = tag<{ now(): number }>('Clock')
export const Db = tag<{ query(sql: string): string[] }>('Db')

const ClockLive = layer(Clock, { now: () => Date.now() }, [], { lifetime: 'app' })
const DbLive = layer(Db, { query: (sql: string) => [sql] }, [], { lifetime: 'app' })

export const Data = module({ name: 'Data', provide: [ClockLive, DbLive], exports: [Clock, Db] })
