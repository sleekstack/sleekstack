import { Context } from 'effect'

export class Db extends Context.Tag('Db')<Db, { readonly query: () => string }>() {}
export class Clock extends Context.Tag('Clock')<Clock, { readonly now: () => number }>() {}
/** Stands in for the generated `Notes` Tag of `virtual:sleek/rpc`. */
export class Notes extends Context.Tag('Notes')<Notes, object>() {}
