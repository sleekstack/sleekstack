/**
 * apps/showcase/src/models/task.ts
 *
 * The task Model (read) and its Drafts (write), in one file. Components import the Model and Draft
 * types; the wire input types stay behind `toDto`.
 */
import { Context, Effect, Schema } from 'effect'
import type { z } from 'zod'
import type { CommentRecord, ProjectRecord, TaskRecord, TaskStatus } from '../domain/entities'
import { AddComment, CreateTask } from '../domain/inputs'
import type { DraftSpec, ModelSpec } from '../lib/contracts'

/** The read DTO is the server's record. */
export type TaskDto = TaskRecord

// Display labels live in the Model, never in components.
const STATUS_LABELS: Record<TaskStatus, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' }

/** Resolves a project's display name. Provided once per load, so N tasks share one lookup. */
export interface ProjectNamesService {
  readonly get: (projectId: string) => string | undefined
}
export const ProjectNames = Context.GenericTag<ProjectNamesService>('ProjectNames')

export interface TaskModel {
  readonly id: string
  readonly title: string
  readonly status: TaskStatus
  readonly statusLabel: string
  readonly projectName: string
  /** Absolute, so it is safe to format here. A relative "5m ago" would freeze at fetch time. */
  readonly createdAtIso: string
}

export const TaskModel = {
  fromDto: (dto) =>
    Effect.map(ProjectNames, (names) => ({
      id: dto.id,
      title: dto.title,
      status: dto.status,
      statusLabel: STATUS_LABELS[dto.status],
      projectName: names.get(dto.projectId) ?? dto.projectId,
      createdAtIso: new Date(dto.createdAt).toISOString(),
    })),
} satisfies ModelSpec<TaskDto, TaskModel, ProjectNamesService>

export type CommentDto = CommentRecord

export interface CommentModel {
  readonly id: string
  readonly body: string
  readonly authorId: string
  readonly createdAtIso: string
}

export const CommentModel = {
  fromDto: (dto) =>
    Effect.succeed({ id: dto.id, body: dto.body, authorId: dto.authorId, createdAtIso: new Date(dto.createdAt).toISOString() }),
} satisfies ModelSpec<CommentDto, CommentModel>

/** What the board renders: every project with its tasks and their comments, all UI-ready. */
export interface BoardProject {
  readonly project: ProjectRecord
  readonly tasks: ReadonlyArray<{ readonly task: TaskModel; readonly comments: readonly CommentModel[] }>
}

/** The board read DTO: what the query caches and the server dehydrates (plain JSON, so it crosses the wire as is). */
const ProjectDto = Schema.Struct({ id: Schema.String, name: Schema.String })
const TaskDtoSchema = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  title: Schema.String,
  status: Schema.Literal('todo', 'in_progress', 'done'),
  createdAt: Schema.Number,
})
const CommentDtoSchema = Schema.Struct({ id: Schema.String, taskId: Schema.String, body: Schema.String, authorId: Schema.String, createdAt: Schema.Number })
export const BoardDto = Schema.Array(
  Schema.Struct({ project: ProjectDto, tasks: Schema.Array(Schema.Struct({ task: TaskDtoSchema, comments: Schema.Array(CommentDtoSchema) })) }),
)
export type BoardDto = typeof BoardDto.Type

/** The board's Model: every task through `TaskModel.fromDto`, with `ProjectNames` built once from the DTO's own projects. */
export const BoardModel = {
  fromDto: (dto) => {
    const names = new Map(dto.map(({ project }) => [project.id, project.name]))
    return Effect.forEach(dto, ({ project, tasks }) =>
      Effect.map(
        Effect.forEach(tasks, ({ task, comments }) =>
          Effect.all({ task: TaskModel.fromDto(task), comments: Effect.forEach(comments, CommentModel.fromDto) })),
        (tasks): BoardProject => ({ project, tasks }),
      )).pipe(Effect.provideService(ProjectNames, { get: (id) => names.get(id) }))
  },
} satisfies ModelSpec<BoardDto, readonly BoardProject[]>

// --- New task: blank create. Fields hold what the inputs hold; no z.coerce. ---

const newTaskSchema = CreateTask.pick({ title: true, simulateFailure: true }).required()
export type NewTaskDraft = z.infer<typeof newTaskSchema>

export interface NewTaskContext {
  readonly projectId: string
}

export const NewTaskDraft = {
  schema: () => newTaskSchema,
  create: (): NewTaskDraft => ({ title: '', simulateFailure: false }),
  toDto: (draft, ctx) =>
    Effect.succeed<CreateTask>({ projectId: ctx.projectId, title: draft.title.trim(), simulateFailure: draft.simulateFailure }),
} satisfies DraftSpec<NewTaskDraft, CreateTask, NewTaskContext>

// --- Comment: a second save boundary on the same task. ---

const commentSchema = AddComment.pick({ body: true })
export type TaskCommentDraft = z.infer<typeof commentSchema>

export interface TaskCommentContext {
  readonly taskId: string
  readonly authorId: string
}

export const TaskCommentDraft = {
  schema: () => commentSchema,
  create: (): TaskCommentDraft => ({ body: '' }),
  toDto: (draft, ctx) => Effect.succeed<AddComment>({ taskId: ctx.taskId, authorId: ctx.authorId, body: draft.body.trim() }),
} satisfies DraftSpec<TaskCommentDraft, AddComment, TaskCommentContext>
