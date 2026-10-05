/**
 * apps/showcase/src/application/board-view.ts
 *
 * The board's read side: the board DTO (projects, their tasks and comments) from BoardStore. The client
 * query caches it and turns it into Models with `BoardModel.fromDto`.
 */
import 'server-only'
import { Effect } from 'effect'
import { BoardStore, type BoardStoreService } from '../domain/tags'
import type { BoardDto } from '../models/task'

// A listed task always exists, so its comment read cannot fail: TaskNotFound there is a defect.
export const loadBoard: Effect.Effect<BoardDto, never, BoardStoreService> = Effect.gen(function* () {
  const store = yield* BoardStore
  return yield* Effect.forEach(yield* store.projects(), (project) =>
    Effect.flatMap(store.tasksOf(project.id), (tasks) =>
      Effect.forEach(tasks, (task) =>
        Effect.map(Effect.orDie(store.commentsOf(task.id)), (comments) => ({ task, comments })),
      ),
    ).pipe(Effect.map((tasks) => ({ project, tasks }))),
  )
})
