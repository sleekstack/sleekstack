/**
 * apps/showcase/src/models/task.server.ts
 *
 * Resolves the board's Models through Effect. Each Model's `fromDto` asks for `ProjectNames` from the
 * environment; `ProjectNamesLive` builds that lookup once from `BoardStore` and is provided once per load,
 * so N tasks share one read.
 */
import 'server-only'
import { Effect, Layer } from 'effect'
import { BoardStore } from '../domain/tags'
import { CommentModel, ProjectNames, TaskModel, type BoardProject } from './task'

export const ProjectNamesLive = Layer.effect(
  ProjectNames,
  Effect.gen(function* () {
    const store = yield* BoardStore
    const names = new Map((yield* store.projects()).map((p) => [p.id, p.name]))
    return { get: (id: string) => names.get(id) }
  }),
)

// A listed task always exists, so its comment read cannot fail: TaskNotFound there is a defect.
export const loadBoardModels = Effect.gen(function* () {
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
