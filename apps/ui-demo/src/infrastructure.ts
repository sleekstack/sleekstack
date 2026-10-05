import { Effect, Layer } from 'effect'
import { QueryClientLive } from '@sleekstack/query'
import {
  ProjectNotFound,
  TaskNotFound,
  TaskRepo,
  UserNotFound,
  UserRepo,
  Viewer,
  type Project,
  type Task,
  type User,
} from './domain'

const users: ReadonlyArray<User> = [
  { id: 'u1', name: 'Ada', canEdit: true },
  { id: 'u2', name: 'Grace', canEdit: false },
  { id: 'u3', name: 'Linus', canEdit: true },
]
const projects: ReadonlyArray<Project> = [
  { id: 'p1', name: 'Launch' },
  { id: 'p2', name: 'Docs' },
]
const tasks: ReadonlyArray<Task> = [
  { id: 't1', projectId: 'p1', title: 'Wire the mount layer', status: 'done', assigneeId: 'u1', votes: 3 },
  { id: 't2', projectId: 'p1', title: 'Write the analyzer pass', status: 'in_progress', assigneeId: 'u3', votes: 5 },
  { id: 't3', projectId: 'p1', title: 'Pick a package name', status: 'todo', assigneeId: null, votes: 0 },
  { id: 't4', projectId: 'p1', title: 'Review the ADR', status: 'todo', assigneeId: 'ghost', votes: 1 },
  { id: 't5', projectId: 'p2', title: 'Document Boundary', status: 'todo', assigneeId: 'u2', votes: 2 },
]

const find = <A extends { id: string }, E>(
  xs: ReadonlyArray<A>,
  id: string,
  fail: (id: string) => E,
): Effect.Effect<A, E> => {
  const hit = xs.find((x) => x.id === id)
  return hit ? Effect.succeed(hit) : Effect.fail(fail(id))
}

export const UserRepoLive = Layer.succeed(UserRepo, {
  all: () => Effect.succeed(users),
  get: (id) => find(users, id, (id) => new UserNotFound({ id })),
})

/** In memory, fresh per build of the layer (so per mount). */
export const TaskRepoLive = Layer.sync(TaskRepo, () => {
  let all = tasks
  return {
    project: (id) => find(projects, id, (id) => new ProjectNotFound({ id })),
    byProject: (id) =>
      find(projects, id, (id) => new ProjectNotFound({ id })).pipe(
        Effect.map((p) => all.filter((t) => t.projectId === p.id)),
      ),
    get: (id) => find(all, id, (id) => new TaskNotFound({ id })),
    ids: () => Effect.sync(() => all.map((t) => t.id)),
    add: (projectId, title) =>
      find(projects, projectId, (id) => new ProjectNotFound({ id })).pipe(
        Effect.map(() => {
          const task: Task = { id: `t${all.length + 1}`, projectId, title, status: 'todo', assigneeId: null, votes: 0 }
          all = [...all, task]
          return task
        }),
      ),
  }
})

export const AppLive = Layer.mergeAll(UserRepoLive, TaskRepoLive)

/** `AppLive` plus the scope's QueryClient, built over it so `effectFn` queries see the repos. */
export const AppWithQueriesLive = (config?: Parameters<typeof QueryClientLive>[0]) =>
  QueryClientLive(config).pipe(Layer.provideMerge(AppLive))

export const ViewerLive = (userId: string) =>
  Layer.effect(
    Viewer,
    UserRepo.get(userId).pipe(
      Effect.map((user) => ({ user })),
      Effect.orDie,
    ),
  ).pipe(Layer.provide(UserRepoLive))
