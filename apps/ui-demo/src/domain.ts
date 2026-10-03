import { Data, Effect, Layer } from 'effect'

export type Status = 'todo' | 'in_progress' | 'done'
export interface User { readonly id: string; readonly name: string; readonly canEdit: boolean }
export interface Project { readonly id: string; readonly name: string }
export interface Task { readonly id: string; readonly projectId: string; readonly title: string; readonly status: Status; readonly assigneeId: string | null; readonly votes: number }

export class ProjectNotFound extends Data.TaggedError('ProjectNotFound')<{ id: string }> {}
export class TaskNotFound extends Data.TaggedError('TaskNotFound')<{ id: string }> {}
export class UserNotFound extends Data.TaggedError('UserNotFound')<{ id: string }> {}

export class UserRepo extends Effect.Tag('UserRepo')<UserRepo, {
  all(): Effect.Effect<ReadonlyArray<User>>
  get(id: string): Effect.Effect<User, UserNotFound>
}>() {}

export class TaskRepo extends Effect.Tag('TaskRepo')<TaskRepo, {
  project(id: string): Effect.Effect<Project, ProjectNotFound>
  byProject(id: string): Effect.Effect<ReadonlyArray<Task>, ProjectNotFound>
  get(id: string): Effect.Effect<Task, TaskNotFound>
}>() {}

/** Who is looking at the board; provided per subtree with `<Provider>`. */
export class Viewer extends Effect.Tag('Viewer')<Viewer, { readonly user: User }>() {}

const users: ReadonlyArray<User> = [
  { id: 'u1', name: 'Ada', canEdit: true },
  { id: 'u2', name: 'Grace', canEdit: false },
  { id: 'u3', name: 'Linus', canEdit: true },
]
const projects: ReadonlyArray<Project> = [{ id: 'p1', name: 'Launch' }, { id: 'p2', name: 'Docs' }]
const tasks: ReadonlyArray<Task> = [
  { id: 't1', projectId: 'p1', title: 'Wire the mount layer', status: 'done', assigneeId: 'u1', votes: 3 },
  { id: 't2', projectId: 'p1', title: 'Write the analyzer pass', status: 'in_progress', assigneeId: 'u3', votes: 5 },
  { id: 't3', projectId: 'p1', title: 'Pick a package name', status: 'todo', assigneeId: null, votes: 0 },
  { id: 't4', projectId: 'p1', title: 'Review the ADR', status: 'todo', assigneeId: 'ghost', votes: 1 },
  { id: 't5', projectId: 'p2', title: 'Document Boundary', status: 'todo', assigneeId: 'u2', votes: 2 },
]

const find = <A extends { id: string }, E>(xs: ReadonlyArray<A>, id: string, fail: (id: string) => E): Effect.Effect<A, E> => {
  const hit = xs.find((x) => x.id === id)
  return hit ? Effect.succeed(hit) : Effect.fail(fail(id))
}

export const UserRepoLive = Layer.succeed(UserRepo, {
  all: () => Effect.succeed(users),
  get: (id) => find(users, id, (id) => new UserNotFound({ id })),
})

export const TaskRepoLive = Layer.succeed(TaskRepo, {
  project: (id) => find(projects, id, (id) => new ProjectNotFound({ id })),
  byProject: (id) =>
    find(projects, id, (id) => new ProjectNotFound({ id })).pipe(Effect.map((p) => tasks.filter((t) => t.projectId === p.id))),
  get: (id) => find(tasks, id, (id) => new TaskNotFound({ id })),
})

export const AppLive = Layer.mergeAll(UserRepoLive, TaskRepoLive)

export const ViewerLive = (userId: string) =>
  Layer.effect(Viewer, UserRepo.get(userId).pipe(Effect.map((user) => ({ user })), Effect.orDie)).pipe(Layer.provide(UserRepoLive))
