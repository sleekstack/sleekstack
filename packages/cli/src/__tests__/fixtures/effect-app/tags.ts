import { Context, type Effect } from 'effect'

export const BoardStore = Context.GenericTag<{ tasks(): Effect.Effect<readonly string[]> }>('BoardStore')
export const ActivityLog = Context.GenericTag<{ record(message: string): void }>('ActivityLog')
export const Clock = Context.GenericTag<{ now(): number }>('Clock')
export const IdGen = Context.GenericTag<{ next(prefix: string): string }>('IdGen')
export const RequestContext = Context.GenericTag<{ readonly requestId: string }>('RequestContext')
