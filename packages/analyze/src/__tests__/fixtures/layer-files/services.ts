import { Context } from 'effect'

export class Config extends Context.Tag('Config')<Config, { readonly url: string }>() {}
export class Db extends Context.Tag('Db')<Db, { readonly url: string }>() {}
export class Repo extends Context.Tag('Repo')<Repo, { readonly url: string }>() {}
export class Ping extends Context.Tag('Ping')<Ping, object>() {}
export class Pong extends Context.Tag('Pong')<Pong, object>() {}
export class Clock extends Context.Tag('Clock')<Clock, { readonly now: () => number }>() {}
export class Mail extends Context.Tag('Mail')<Mail, object>() {}
export class Smtp extends Context.Tag('Smtp')<Smtp, object>() {}
