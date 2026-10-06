import { Effect } from 'effect'
import type { TaskNotFound } from './errors'
import type { NewTask, Status, Task } from './model'

export class TaskRepo extends Effect.Tag('TaskRepo')<
  TaskRepo,
  {
    byProject(projectId: string): Effect.Effect<ReadonlyArray<Task>>
    add(projectId: string, task: NewTask): Effect.Effect<Task>
    move(id: string, status: Status): Effect.Effect<Task, TaskNotFound>
    remove(id: string): Effect.Effect<void, TaskNotFound>
  }
>() {}
