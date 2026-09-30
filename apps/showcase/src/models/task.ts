/**
 * apps/showcase/src/models/task.ts
 *
 * The task Model (read) and its Drafts (write), in one file. Components import the Model and Draft
 * types; the wire input types stay behind `toDto`.
 */
import { z } from 'zod'
import type { AddCommentInput, CreateTaskInput } from '../server/board.actions'
import type { CommentRecord, ProjectRecord, TaskRecord, TaskStatus } from '../domain/tags'
import type { DraftSpec, ModelSpec } from './contracts'

/** The read DTO is the server's record. */
export type TaskDto = TaskRecord

// Display labels live in the Model, never in components.
const STATUS_LABELS: Record<TaskStatus, string> = { todo: 'To do', in_progress: 'In progress', done: 'Done' }

/** Context: resolved data only, declared narrowly for this Model. */
export interface TaskContext {
  readonly projectNames: ReadonlyMap<string, string>
}

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
  fromDto(dto, ctx) {
    return {
      id: dto.id,
      title: dto.title,
      status: dto.status,
      statusLabel: STATUS_LABELS[dto.status],
      projectName: ctx.projectNames.get(dto.projectId) ?? dto.projectId,
      createdAtIso: new Date(dto.createdAt).toISOString(),
    }
  },
} satisfies ModelSpec<TaskDto, TaskModel, TaskContext>

export type CommentDto = CommentRecord

export interface CommentModel {
  readonly id: string
  readonly body: string
  readonly authorId: string
  readonly createdAtIso: string
}

export const CommentModel = {
  fromDto: (dto) => ({ id: dto.id, body: dto.body, authorId: dto.authorId, createdAtIso: new Date(dto.createdAt).toISOString() }),
} satisfies ModelSpec<CommentDto, CommentModel>

/** What the board renders: every project with its tasks and their comments, all UI-ready. */
export interface BoardProject {
  readonly project: ProjectRecord
  readonly tasks: ReadonlyArray<{ readonly task: TaskModel; readonly comments: readonly CommentModel[] }>
}

// --- New task: blank create. Fields hold what the inputs hold; no z.coerce. ---

const newTaskSchema = z.object({
  title: z.string().trim().min(1, 'Please enter a title'),
  simulateFailure: z.boolean(),
})
export type NewTaskDraft = z.infer<typeof newTaskSchema>

export interface NewTaskContext {
  readonly projectId: string
}

export const NewTaskDraft = {
  schema: () => newTaskSchema,
  create: (): NewTaskDraft => ({ title: '', simulateFailure: false }),
  toDto: (draft, ctx): CreateTaskInput => ({
    projectId: ctx.projectId,
    title: draft.title.trim(),
    simulateFailure: draft.simulateFailure,
  }),
} satisfies DraftSpec<NewTaskDraft, CreateTaskInput, NewTaskContext>

// --- Comment: a second save boundary on the same task. ---

const commentSchema = z.object({ body: z.string().trim().min(1, 'Please enter a comment') })
export type TaskCommentDraft = z.infer<typeof commentSchema>

export interface TaskCommentContext {
  readonly taskId: string
  readonly authorId: string
}

export const TaskCommentDraft = {
  schema: () => commentSchema,
  create: (): TaskCommentDraft => ({ body: '' }),
  toDto: (draft, ctx): AddCommentInput => ({ taskId: ctx.taskId, authorId: ctx.authorId, body: draft.body.trim() }),
} satisfies DraftSpec<TaskCommentDraft, AddCommentInput, TaskCommentContext>
