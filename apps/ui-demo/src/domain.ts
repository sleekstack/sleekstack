import { Data, Effect } from 'effect'

export type Status = 'todo' | 'in_progress' | 'done'
export type Priority = 'low' | 'medium' | 'high'
export interface User {
  readonly id: string
  readonly name: string
  readonly canEdit: boolean
}
export interface Project {
  readonly id: string
  readonly name: string
}
export interface Task {
  readonly id: string
  readonly projectId: string
  readonly title: string
  readonly status: Status
  readonly priority: Priority
  readonly labels: ReadonlyArray<string>
  /** ISO date, or null. */
  readonly due: string | null
  /** A user id; may name someone who has since left the team. */
  readonly assigneeId: string | null
  readonly votes: number
}
export interface NewTask {
  readonly title: string
  readonly priority: Priority
}

export class ProjectNotFound extends Data.TaggedError('ProjectNotFound')<{ id: string }> {}
export class TaskNotFound extends Data.TaggedError('TaskNotFound')<{ id: string }> {}
export class UserNotFound extends Data.TaggedError('UserNotFound')<{ id: string }> {}

export class UserRepo extends Effect.Tag('UserRepo')<
  UserRepo,
  {
    all(): Effect.Effect<ReadonlyArray<User>>
    get(id: string): Effect.Effect<User, UserNotFound>
  }
>() {}

export class TaskRepo extends Effect.Tag('TaskRepo')<
  TaskRepo,
  {
    projects(): Effect.Effect<ReadonlyArray<Project>>
    project(id: string): Effect.Effect<Project, ProjectNotFound>
    byProject(id: string): Effect.Effect<ReadonlyArray<Task>, ProjectNotFound>
    add(projectId: string, task: NewTask): Effect.Effect<Task, ProjectNotFound>
    move(id: string, status: Status): Effect.Effect<Task, TaskNotFound>
    remove(id: string): Effect.Effect<void, TaskNotFound>
  }
>() {}

/** Who is looking at the board; provided per subtree with `<Provider>`. */
export class Viewer extends Effect.Tag('Viewer')<Viewer, { readonly user: User }>() {}
