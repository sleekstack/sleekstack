/**
 * apps/showcase/src/models/task.server.ts
 *
 * Resolves the board's Models through Effect. Each Model's `fromDto` asks for `ProjectNames` from the
 * environment; `ProjectNamesLive` builds that lookup once from `ProjectRepo` and is provided once per load,
 * so N tasks share one read.
 */
import 'server-only'
import { Effect, Layer } from 'effect'
import { CommentRepo, ProjectRepo, TaskRepo } from '../domain/tags'
import { CommentModel, ProjectNames, TaskModel, type BoardProject } from './task'

export const ProjectNamesLive = Layer.effect(
  ProjectNames,
  Effect.map(ProjectRepo, (repo) => {
    const names = new Map(repo.list().map((p) => [p.id, p.name]))
    return { get: (id: string) => names.get(id) }
  }),
)

export const loadBoardModels = Effect.gen(function* () {
  const projectRepo = yield* ProjectRepo
  const taskRepo = yield* TaskRepo
  const commentRepo = yield* CommentRepo
  return yield* Effect.forEach(projectRepo.list(), (project) =>
    Effect.forEach(taskRepo.listByProject(project.id), (dto) =>
      Effect.all({
        task: TaskModel.fromDto(dto),
        comments: Effect.forEach(commentRepo.listByTask(dto.id), CommentModel.fromDto),
      }),
    ).pipe(Effect.map((tasks): BoardProject => ({ project, tasks }))),
  )
}).pipe(Effect.provide(ProjectNamesLive))
