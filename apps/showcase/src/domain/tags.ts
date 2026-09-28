/**
 * apps/showcase/src/domain/tags.ts
 *
 * Tag-only module (R10): identifiers safe for client code to import. No
 * implementations here — see the sibling `*.server.ts` files for the Layer
 * factories. A bundle that imports only this file never pulls in a server
 * implementation (pattern: apps/playground/src/tags.ts).
 */
import { Context } from 'effect'

export type TaskStatus = 'todo' | 'in_progress' | 'done'

export interface ProjectRecord {
  readonly id: string
  readonly name: string
}

export interface TaskRecord {
  readonly id: string
  readonly projectId: string
  readonly title: string
  readonly status: TaskStatus
  readonly createdAt: number
}

export interface CommentRecord {
  readonly id: string
  readonly taskId: string
  readonly body: string
  readonly authorId: string
  readonly createdAt: number
}

export interface ActivityEvent {
  readonly id: string
  readonly message: string
  readonly at: number
}

/** In-memory tables, seeded once at module scope (fn-2 non-goal: no real persistence). */
export interface StoreService {
  readonly projects: Map<string, ProjectRecord>
  readonly tasks: Map<string, TaskRecord>
  readonly comments: Map<string, CommentRecord>
}

export interface ProjectRepoService {
  list(): readonly ProjectRecord[]
  get(id: string): ProjectRecord | undefined
}

export interface TaskRepoService {
  listByProject(projectId: string): readonly TaskRecord[]
  get(id: string): TaskRecord | undefined
  create(input: { readonly projectId: string; readonly title: string }): TaskRecord
  move(id: string, status: TaskStatus): TaskRecord
}

export interface CommentRepoService {
  listByTask(taskId: string): readonly CommentRecord[]
  create(input: { readonly taskId: string; readonly body: string; readonly authorId: string }): CommentRecord
}

export interface ActivityLogService {
  record(message: string): void
  list(): readonly ActivityEvent[]
}

export interface ClockService {
  now(): number
}

export interface LoggerService {
  log(message: string): void
}

export interface IdGenService {
  next(prefix: string): string
}

export const Store = Context.GenericTag<StoreService>('Store')
export const ProjectRepo = Context.GenericTag<ProjectRepoService>('ProjectRepo')
export const TaskRepo = Context.GenericTag<TaskRepoService>('TaskRepo')
export const CommentRepo = Context.GenericTag<CommentRepoService>('CommentRepo')
export const ActivityLog = Context.GenericTag<ActivityLogService>('ActivityLog')
export const Clock = Context.GenericTag<ClockService>('Clock')
export const Logger = Context.GenericTag<LoggerService>('Logger')
export const IdGen = Context.GenericTag<IdGenService>('IdGen')
