/**
 * apps/showcase/src/infrastructure/board-store.memory.ts
 *
 * The in-memory BoardStore. A transaction works on its own copy of the tables
 * and swaps it in only on success, under a one-permit lock: a failing
 * transaction leaves the committed tables as they were, and can never erase a
 * concurrent transaction's write. Ids and timestamps come from the caller.
 */
import 'server-only'
import { Effect, Layer } from 'effect'
import { TaskNotFound } from '../domain/errors'
import type { BoardReads, BoardStoreService, BoardTx, CommentRecord, ProjectRecord, TaskRecord } from '../domain/tags'
import { BoardStore } from '../domain/tags'

interface Tables {
  readonly projects: Map<string, ProjectRecord>
  readonly tasks: Map<string, TaskRecord>
  readonly comments: Map<string, CommentRecord>
}

export interface BoardSeed {
  readonly projects: readonly ProjectRecord[]
  readonly tasks: readonly TaskRecord[]
  readonly comments: readonly CommentRecord[]
}

const copy = (t: Tables): Tables => ({ projects: new Map(t.projects), tasks: new Map(t.tasks), comments: new Map(t.comments) })

const readsOf = (tables: () => Tables): BoardReads => {
  const task = (id: string) =>
    Effect.suspend(() => {
      const found = tables().tasks.get(id)
      return found ? Effect.succeed(found) : Effect.fail(new TaskNotFound({ taskId: id }))
    })
  return {
    projects: () => Effect.sync(() => [...tables().projects.values()]),
    tasksOf: (projectId) => Effect.sync(() => [...tables().tasks.values()].filter((t) => t.projectId === projectId)),
    task,
    commentsOf: (taskId) =>
      Effect.map(task(taskId), () => [...tables().comments.values()].filter((c) => c.taskId === taskId)),
  }
}

export const makeBoardStore = (seed: BoardSeed): BoardStoreService => {
  let committed: Tables = {
    projects: new Map(seed.projects.map((p) => [p.id, p])),
    tasks: new Map(seed.tasks.map((t) => [t.id, t])),
    comments: new Map(seed.comments.map((c) => [c.id, c])),
  }
  // ponytail: one global lock; per-project locks if write throughput ever matters.
  const lock = Effect.unsafeMakeSemaphore(1)
  return {
    ...readsOf(() => committed),
    transaction: (f) =>
      lock.withPermits(1)(
        Effect.suspend(() => {
          const work = copy(committed)
          const reads = readsOf(() => work)
          const tx: BoardTx = {
            ...reads,
            createTask: (record) => Effect.sync(() => (work.tasks.set(record.id, record), record)),
            moveTask: (id, status) =>
              Effect.map(reads.task(id), (existing) => {
                const moved = { ...existing, status }
                work.tasks.set(id, moved)
                return moved
              }),
            addComment: (record) =>
              Effect.as(reads.task(record.taskId), record).pipe(Effect.tap(() => void work.comments.set(record.id, record))),
          }
          // Publish a detached copy: a BoardTx kept past its transaction only ever writes an orphan.
          return Effect.tap(f(tx), () => void (committed = copy(work)))
        }),
      ),
  }
}

const seed: BoardSeed = {
  projects: [
    { id: 'proj_1', name: 'SleekStack Launch' },
    { id: 'proj_2', name: 'Docs Overhaul' },
  ],
  tasks: [
    { id: 'task_1', projectId: 'proj_1', title: 'Wire up the graph explorer', status: 'in_progress', createdAt: 1 },
    { id: 'task_2', projectId: 'proj_1', title: 'Ship the error gallery', status: 'todo', createdAt: 2 },
    { id: 'task_3', projectId: 'proj_2', title: 'Write the README', status: 'todo', createdAt: 3 },
  ],
  comments: [{ id: 'comment_1', taskId: 'task_1', body: 'Looking good so far.', authorId: 'user_1', createdAt: 1 }],
}

// Module scope: survives across requests (a restart resets it; no real persistence).
export const BoardStoreLive = Layer.succeed(BoardStore, makeBoardStore(seed))
