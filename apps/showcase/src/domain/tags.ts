/**
 * apps/showcase/src/domain/tags.ts
 *
 * Tag-only module (R10): identifiers safe for client code to import. No
 * implementations here — see the sibling `*.server.ts` files for the Layer
 * factories. A bundle that imports only this file never pulls in a server
 * implementation (pattern: apps/playground/src/tags.ts).
 */
import { Context, type Effect } from 'effect'
import type { TaskNotFound } from './errors'

export type { ActivityEvent, CommentRecord, ProjectRecord, TaskRecord, TaskStatus } from './entities'
import type { ActivityEvent, CommentRecord, ProjectRecord, TaskRecord, TaskStatus } from './entities'

/** Reads, available on the store (committed state) and on a transaction (its own writes included). */
export interface BoardReads {
  projects(): Effect.Effect<readonly ProjectRecord[]>
  tasksOf(projectId: string): Effect.Effect<readonly TaskRecord[]>
  task(id: string): Effect.Effect<TaskRecord, TaskNotFound>
  commentsOf(taskId: string): Effect.Effect<readonly CommentRecord[], TaskNotFound>
}

/** A transaction's view: reads plus the only writes. Records arrive complete (ids and timestamps are the caller's). */
export interface BoardTx extends BoardReads {
  createTask(record: TaskRecord): Effect.Effect<TaskRecord>
  moveTask(id: string, status: TaskStatus): Effect.Effect<TaskRecord, TaskNotFound>
  addComment(record: CommentRecord): Effect.Effect<CommentRecord, TaskNotFound>
}

export interface BoardStoreService extends BoardReads {
  /** Serialized and all-or-nothing: if `f` fails, none of its writes are kept. */
  transaction<A, E, R>(f: (tx: BoardTx) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R>
}

export interface ActivityLogService {
  record(message: string): void
  list(): readonly ActivityEvent[]
}

export interface ClockService {
  now(): number
}

export interface IdGenService {
  next(prefix: string): string
}

export const BoardStore = Context.GenericTag<BoardStoreService>('BoardStore')
export const ActivityLog = Context.GenericTag<ActivityLogService>('ActivityLog')
export const Clock = Context.GenericTag<ClockService>('Clock')
export const IdGen = Context.GenericTag<IdGenService>('IdGen')
