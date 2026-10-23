import { Context } from 'effect'

export class Config extends Context.Tag('Config')<Config, { readonly url: string }>() {}
export class Db extends Context.Tag('Db')<Db, { readonly url: string }>() {}
