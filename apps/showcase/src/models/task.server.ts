/**
 * apps/showcase/src/models/task.server.ts
 *
 * Resolves the board's Models through Effect: the repos are read from the environment, the Model `Ctx`
 * (project names) is built once from that data, and each DTO goes through its pure `fromDto`.
 */
import 'server-only'
import { Effect } from 'effect'
import { CommentRepo, ProjectRepo, TaskRepo } from '../domain/tags'
import { CommentModel, TaskModel, type BoardProject } from './task'

export const loadBoardModels = Effect.gen(function* () {
  const projectRepo = yield* ProjectRepo
  const taskRepo = yield* TaskRepo
  const commentRepo = yield* CommentRepo
  const projects = projectRepo.list()
  const ctx = { projectNames: new Map(projects.map((p) => [p.id, p.name])) }
  return projects.map((project): BoardProject => ({
    project,
    tasks: taskRepo.listByProject(project.id).map((dto) => ({
      task: TaskModel.fromDto(dto, ctx),
      comments: commentRepo.listByTask(dto.id).map(CommentModel.fromDto),
    })),
  }))
})
