import { Context } from 'effect'

export class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
export class IdGen extends Context.Tag('IdGen')<IdGen, { next(p: string): string }>() {}
export class Store extends Context.Tag('Store')<Store, object>() {}
export class TaskRepo extends Context.Tag('TaskRepo')<TaskRepo, object>() {}
export class ActivityLog extends Context.Tag('ActivityLog')<ActivityLog, object>() {}
