import { Effect } from 'effect'
import type { ProjectNotFound, TaskNotFound, UserNotFound } from './errors'
import type { NewTask, Project, Status, Task, User } from './model'

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
