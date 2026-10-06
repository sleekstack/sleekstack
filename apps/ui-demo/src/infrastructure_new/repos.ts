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
  { id: 'p1', name: 'Website relaunch' },
  { id: 'p2', name: 'Mobile app' },
]
// `u9` left the team: tasks that name them still render.
const tasks: ReadonlyArray<Task> = [
  { id: 't1', projectId: 'p1', title: 'Migrate the blog to the new CMS', status: 'done', priority: 'medium', labels: ['content'], due: '2026-10-02', assigneeId: 'u1', votes: 3 },
  { id: 't2', projectId: 'p1', title: 'Fix the checkout redirect loop', status: 'in_progress', priority: 'high', labels: ['bug', 'payments'], due: '2026-10-09', assigneeId: 'u3', votes: 5 },
  { id: 't3', projectId: 'p1', title: 'Pick a cookie consent provider', status: 'todo', priority: 'low', labels: ['legal'], due: null, assigneeId: null, votes: 0 },
  { id: 't4', projectId: 'p1', title: 'Audit the image sizes on the landing page', status: 'todo', priority: 'medium', labels: ['performance'], due: '2026-10-16', assigneeId: 'u9', votes: 1 },
  { id: 't5', projectId: 'p2', title: 'Ship offline mode for the task list', status: 'todo', priority: 'high', labels: ['feature'], due: '2026-11-01', assigneeId: 'u2', votes: 2 },
  { id: 't6', projectId: 'p2', title: 'Crash on rotating the settings screen', status: 'in_progress', priority: 'high', labels: ['bug'], due: '2026-10-08', assigneeId: 'u1', votes: 4 },
]

const find = <A extends { id: string }, E>(
  xs: ReadonlyArray<A>,
  id: string,
  fail: (id: string) => E,
): Effect.Effect<A, E> => {
  const hit = xs.find((x) => x.id === id)
  return hit ? Effect.succeed(hit) : Effect.fail(fail(id))
}
const noProject = (id: string) => new ProjectNotFound({ id })
const noTask = (id: string) => new TaskNotFound({ id })

export const UserRepoLive = Layer.succeed(UserRepo, {
  all: () => Effect.succeed(users),
  get: (id) => find(users, id, (id) => new UserNotFound({ id })),
})

/** In memory, fresh per build of the layer (so per mount). */
export const TaskRepoLive = Layer.sync(TaskRepo, () => {
  let all = tasks
  let next = tasks.length
  return {
    projects: () => Effect.succeed(projects),
    project: (id) => find(projects, id, noProject),
    byProject: (id) =>
      find(projects, id, noProject).pipe(Effect.map((p) => all.filter((t) => t.projectId === p.id))),
    add: (projectId, { title, priority }) =>
      find(projects, projectId, noProject).pipe(
        Effect.map(() => {
          const task: Task = {
            id: `t${++next}`,
            projectId,
            title,
            status: 'todo',
            priority,
            labels: [],
            due: null,
            assigneeId: null,
            votes: 0,
          }
          all = [...all, task]
          return task
        }),
      ),
    move: (id, status) =>
      find(all, id, noTask).pipe(
        Effect.map((t) => {
          const moved = { ...t, status }
          all = all.map((x) => (x.id === id ? moved : x))
          return moved
        }),
      ),
    remove: (id) =>
      find(all, id, noTask).pipe(
        Effect.map(() => {
          all = all.filter((x) => x.id !== id)
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
