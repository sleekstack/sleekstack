/**
 * apps/showcase/src/application/board-view.ts
 *
 * The board's read side: resolves the UI-ready projection (Models with project names) from BoardStore.
 */
import 'server-only'
import { Effect } from 'effect'
import { BoardStore, type BoardStoreService } from '../domain/tags'
import { CommentModel, TaskModel, type BoardProject } from '../models/task'
import { ProjectNamesLive } from '../models/task.server'

export type BoardView = readonly BoardProject[]

// A listed task always exists, so its comment read cannot fail: TaskNotFound there is a defect.
export const loadBoard: Effect.Effect<BoardView, never, BoardStoreService> = Effect.gen(function* () {
  const store = yield* BoardStore
  return yield* Effect.forEach(yield* store.projects(), (project) =>
    Effect.flatMap(store.tasksOf(project.id), (dtos) =>
      Effect.forEach(dtos, (dto) =>
        Effect.all({
          task: TaskModel.fromDto(dto),
          comments: Effect.flatMap(Effect.orDie(store.commentsOf(dto.id)), (cs) => Effect.forEach(cs, CommentModel.fromDto)),
        }),
      ),
    ).pipe(Effect.map((tasks): BoardProject => ({ project, tasks }))),
  )
}).pipe(Effect.provide(ProjectNamesLive))
