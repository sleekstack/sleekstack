import { Context } from 'effect'

export interface ClockService { now(): number }
export interface IdGenService { next(p: string): string }
export interface StoreService { readonly rows: Map<string, string> }
export interface TaskRepoService { count(): number }
export interface ActivityLogService { record(m: string): void }

export const Clock = Context.GenericTag<ClockService>('Clock')
export const IdGen = Context.GenericTag<IdGenService>('IdGen')
export const Store = Context.GenericTag<StoreService>('Store')
export const TaskRepo = Context.GenericTag<TaskRepoService>('TaskRepo')
export const ActivityLog = Context.GenericTag<ActivityLogService>('ActivityLog')
