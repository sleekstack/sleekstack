/**
 * apps/showcase-kit/src/domain/modules.server.ts
 *
 * The domain graph, kit-only: Infra -> Data -> Activity -> App.
 * Store is private to Data (left out of its exports); App imports through a
 * thunk and adds the request-lifetime RequestContext.
 */
import 'server-only'
import { layer, module } from '@sleekstack/kit'
import {
  ActivityLog, Clock, CommentRepo, IdGen, Logger, ProjectRepo, Store, TaskRepo,
  type ActivityEvent, type CommentRecord, type ProjectRecord, type StoreService, type TaskRecord, type TaskStatus,
} from './tags'
import { RequestContext, RequestContextLayer, UnitOfWork, UnitOfWorkLayer } from '../server/request.server'

let seq = 0
export const ClockLayer = layer(Clock, { now: () => Date.now() })
export const LoggerLayer = layer(Logger, { log: (message: string) => console.log('[showcase-kit]', message) })
export const IdGenLayer = layer(IdGen, { next: (prefix: string) => `${prefix}_${++seq}` })

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

// App lifetime: built once per runtime, so it survives across requests (no real persistence).
export const StoreLayer = layer(Store, (): StoreService => ({
  projects: new Map(seedProjects.map((p) => [p.id, p])),
  tasks: new Map(seedTasks.map((t) => [t.id, t])),
  comments: new Map(seedComments.map((c) => [c.id, c])),
}))

export const ProjectRepoLayer = layer(ProjectRepo, (store) => ({
  list: () => [...store.projects.values()],
  get: (id: string) => store.projects.get(id),
}), [Store])

export const TaskRepoLayer = layer(TaskRepo, (store, idGen, clock) => ({
  listByProject: (projectId: string) => [...store.tasks.values()].filter((t) => t.projectId === projectId),
  get: (id: string) => store.tasks.get(id),
  create: (input: { readonly projectId: string; readonly title: string }) => {
    const task: TaskRecord = { id: idGen.next('task'), projectId: input.projectId, title: input.title, status: 'todo', createdAt: clock.now() }
    store.tasks.set(task.id, task)
    return task
  },
  move: (id: string, status: TaskStatus) => {
    const existing = store.tasks.get(id)
    if (!existing) throw new Error(`Unknown task id: ${id}`)
    const moved = { ...existing, status }
    store.tasks.set(id, moved)
    return moved
  },
}), [Store, IdGen, Clock])

export const CommentRepoLayer = layer(CommentRepo, (store, idGen, clock) => ({
  listByTask: (taskId: string) => [...store.comments.values()].filter((c) => c.taskId === taskId),
  create: (input: { readonly taskId: string; readonly body: string; readonly authorId: string }) => {
    const comment: CommentRecord = { id: idGen.next('comment'), createdAt: clock.now(), ...input }
    store.comments.set(comment.id, comment)
    return comment
  },
}), [Store, IdGen, Clock])

export const ActivityLogLayer = layer(ActivityLog, (clock) => {
  const events: ActivityEvent[] = []
  let n = 0
  return {
    record: (message: string) => void events.push({ id: `evt_${++n}`, message, at: clock.now() }),
    list: () => [...events],
  }
}, [Clock])

export const InfraModule = module({
  name: 'Infra',
  provide: [ClockLayer, LoggerLayer, IdGenLayer],
  exports: [Clock, Logger, IdGen],
})

export const DataModule = module({
  name: 'Data',
  imports: [InfraModule],
  provide: [StoreLayer, ProjectRepoLayer, TaskRepoLayer, CommentRepoLayer, UnitOfWorkLayer],
  // Store is deliberately left out: private to this module.
  exports: [ProjectRepo, TaskRepo, CommentRepo, UnitOfWork],
})

export const ActivityModule = module({
  name: 'Activity',
  imports: [InfraModule],
  provide: [ActivityLogLayer],
  exports: [ActivityLog],
})

export const AppModule = module({
  name: 'App',
  imports: () => [DataModule, ActivityModule],
  provide: [RequestContextLayer],
  exports: [ProjectRepo, TaskRepo, CommentRepo, ActivityLog, Clock, Logger, IdGen, RequestContext, UnitOfWork],
})
