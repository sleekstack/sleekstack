import { Data, Effect } from 'effect'

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
  ids(): Effect.Effect<ReadonlyArray<string>>
  add(projectId: string, title: string): Effect.Effect<Task, ProjectNotFound>
}>() {}

/** Who is looking at the board; provided per subtree with `<Provider>`. */
export class Viewer extends Effect.Tag('Viewer')<Viewer, { readonly user: User }>() {}

/** An id no repo holds: the demo uses it to show the `TaskNotFound` Boundary. */
export const MISSING_TASK = 'nope'
