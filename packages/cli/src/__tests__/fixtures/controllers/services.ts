import { Context } from 'effect'

export class Clock extends Context.Tag('Clock')<Clock, { readonly now: () => number }>() {}
