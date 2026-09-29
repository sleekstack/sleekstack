/**
 * apps/showcase/src/domain/live.server.ts
 *
 * The app's Layers, plain Effect: Infra (Clock, Logger, IdGen) -> Store ->
 * repos + ActivityLog. `AppLive` is what the server ManagedRuntime builds once.
 */
import 'server-only'
import { Effect, Layer } from 'effect'
import type { ActivityEvent, CommentRecord, ProjectRecord, StoreService, TaskRecord } from './tags'
import { ActivityLog, Clock, CommentRepo, IdGen, Logger, ProjectRepo, Store, TaskRepo } from './tags'

export const SERVER_ONLY_MARKER = 'sleekstack-showcase-server-only-9d7b3e12'

let seq = 0
const InfraLive = Layer.mergeAll(
  Layer.succeed(Clock, { now: () => Date.now() }),
  Layer.succeed(Logger, { log: (message: string) => console.log('[showcase]', message) }),
  Layer.succeed(IdGen, { next: (prefix: string) => `${prefix}_${++seq}` }),
  Layer.effectDiscard(Effect.sync(() => console.log(SERVER_ONLY_MARKER, '[Infra] startup'))),
)

const seedProjects: readonly ProjectRecord[] = [
  { id: 'proj_1', name: 'SleekStack Launch' },
  { id: 'proj_2', name: 'Docs Overhaul' },
]
const seedTasks: readonly TaskRecord[] = [
  { id: 'task_1', projectId: 'proj_1', title: 'Wire up the graph explorer', status: 'in_progress', createdAt: 1 },
  { id: 'task_2', projectId: 'proj_1', title: 'Ship the error gallery', status: 'todo', createdAt: 2 },
  { id: 'task_3', projectId: 'proj_2', title: 'Write the README', status: 'todo', createdAt: 3 },
]
const seedComments: readonly CommentRecord[] = [
  { id: 'comment_1', taskId: 'task_1', body: 'Looking good so far.', authorId: 'user_1', createdAt: 1 },
]

// Module scope: survives across requests (a restart resets it; no real persistence).
const store: StoreService = {
  projects: new Map(seedProjects.map((p) => [p.id, p])),
  tasks: new Map(seedTasks.map((t) => [t.id, t])),
  comments: new Map(seedComments.map((c) => [c.id, c])),
}
export const StoreLive = Layer.succeed(Store, store)

const ProjectRepoLive = Layer.effect(
  ProjectRepo,
  Effect.map(Store, (store) => ({
    list: () => [...store.projects.values()],
    get: (id: string) => store.projects.get(id),
  })),
)

const TaskRepoLive = Layer.effect(
  TaskRepo,
  Effect.all([Store, IdGen, Clock]).pipe(
    Effect.map(([store, idGen, clock]) => ({
      listByProject: (projectId: string) => [...store.tasks.values()].filter((t) => t.projectId === projectId),
      get: (id: string) => store.tasks.get(id),
      create: (input: { readonly projectId: string; readonly title: string }) => {
        const task = {
          id: idGen.next('task'),
          projectId: input.projectId,
          title: input.title,
          status: 'todo' as const,
          createdAt: clock.now(),
        }
        store.tasks.set(task.id, task)
        return task
      },
      move: (id: string, status: TaskRecord['status']) => {
        const existing = store.tasks.get(id)
        if (!existing) throw new Error(`Unknown task id: ${id}`)
        const moved = { ...existing, status }
        store.tasks.set(id, moved)
        return moved
      },
    })),
  ),
)

const CommentRepoLive = Layer.effect(
  CommentRepo,
  Effect.all([Store, IdGen, Clock]).pipe(
    Effect.map(([store, idGen, clock]) => ({
      listByTask: (taskId: string) => [...store.comments.values()].filter((c) => c.taskId === taskId),
      create: (input: { readonly taskId: string; readonly body: string; readonly authorId: string }) => {
        const comment = { id: idGen.next('comment'), createdAt: clock.now(), ...input }
        store.comments.set(comment.id, comment)
        return comment
      },
    })),
  ),
)

const ActivityLogLive = Layer.effect(
  ActivityLog,
  Effect.map(Clock, (clock) => {
    const events: ActivityEvent[] = []
    let seq = 0
    return {
      record: (message: string) => {
        events.push({ id: `evt_${++seq}`, message, at: clock.now() })
      },
      list: () => [...events],
    }
  }),
)

export const AppLive = Layer.mergeAll(ProjectRepoLive, TaskRepoLive, CommentRepoLive, ActivityLogLive).pipe(
  Layer.provideMerge(StoreLive),
  Layer.provideMerge(InfraLive),
)
