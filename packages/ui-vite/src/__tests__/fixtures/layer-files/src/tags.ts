import { Context } from 'effect'

export class Config extends Context.Tag('Config')<Config, { readonly greeting: string }>() {}
export class Db extends Context.Tag('Db')<Db, { readonly greeting: string }>() {}
export class Greeter extends Context.Tag('Greeter')<Greeter, { readonly greet: (name: string) => string }>() {}
