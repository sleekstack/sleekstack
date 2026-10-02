'use server'
/**
 * apps/showcase/src/server/board.actions.ts
 *
 * The board's mutating Server Actions (R5): each wraps an inner `action()`
 * operation that validates input, stages its Store write through UnitOfWork,
 * and commits last. Next production hides thrown server messages, so an
 * expected failure (validation, "simulate failure") is returned as
 * `{ ok: false, error }`, never thrown; only an unexpected defect reaches
 * `error.tsx`.
 */
import { Effect } from 'effect'
import type { z } from 'zod'
import { InvalidInput, SimulatedFailure, TaskNotFound, type DomainError } from '../domain/errors'
import { AddComment, CreateTask, MoveTask } from '../domain/inputs'
import { ActivityLog, CommentRepo, TaskRepo, type CommentRecord, type TaskRecord, type TaskStatus } from '../domain/tags'
import { RequestContext, UnitOfWork } from './request.server'
import { runApp } from './runtime.server'

export type ActionResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string }

/** Server-facing wording per field; the rule itself lives only in the domain schema. */
const SERVER_MESSAGES: Record<string, string> = { title: 'Task title cannot be empty', body: 'Comment body cannot be empty' }

/** Parses with the domain schema; the first issue becomes the `InvalidInput` message. */
const parse = <S extends z.ZodType>(schema: S, input: unknown): Effect.Effect<z.output<S>, InvalidInput> => {
  const r = schema.safeParse(input)
  if (r.success) return Effect.succeed(r.data)
  const issue = r.error.issues[0]
  return Effect.fail(new InvalidInput({ message: SERVER_MESSAGES[String(issue?.path[0])] ?? issue?.message ?? 'Invalid input' }))
}

/**
 * Only a modeled `DomainError` becomes `{ ok: false, error }`. A defect or
 * finalizer failure rejects, so it reaches `error.tsx` instead.
 */
const toResult = <T>(program: Effect.Effect<T, DomainError, any>): Promise<ActionResult<T>> =>
  runApp(
    program.pipe(
      Effect.map((data): ActionResult<T> => ({ ok: true, data })),
      Effect.catchAll((e) => Effect.succeed<ActionResult<T>>({ ok: false, error: e.message })),
    ),
  )

export type CreateTaskInput = CreateTask

export async function createTask(input: CreateTaskInput): Promise<ActionResult<TaskRecord>> {
  return toResult(
    Effect.gen(function* () {
      yield* RequestContext
      const { projectId, title, simulateFailure } = yield* parse(CreateTask, input)
      const taskRepo = yield* TaskRepo
      const activityLog = yield* ActivityLog
      const uow = yield* UnitOfWork
      let created!: TaskRecord
      uow.stage(() => {
        created = taskRepo.create({ projectId, title })
        activityLog.record(`Task created: ${created.id} "${created.title}"`)
      })
      if (simulateFailure) return yield* new SimulatedFailure({ message: 'Simulated failure: create rejected before commit' })
      yield* uow.commit
      return created
    }),
  )
}

export type MoveTaskInput = MoveTask

export async function moveTask(input: MoveTaskInput): Promise<ActionResult<TaskRecord>> {
  return toResult(
    Effect.gen(function* () {
      yield* RequestContext
      const { taskId, status } = yield* parse(MoveTask, input)
      const taskRepo = yield* TaskRepo
      const activityLog = yield* ActivityLog
      const uow = yield* UnitOfWork
      if (!taskRepo.get(taskId)) return yield* new TaskNotFound({ taskId })
      let moved!: TaskRecord
      uow.stage(() => {
        moved = taskRepo.move(taskId, status)
        activityLog.record(`Task moved: ${moved.id} -> ${moved.status}`)
      })
      yield* uow.commit
      return moved
    }),
  )
}

export type AddCommentInput = AddComment

export async function addComment(input: AddCommentInput): Promise<ActionResult<CommentRecord>> {
  return toResult(
    Effect.gen(function* () {
      yield* RequestContext
      const { taskId, body, authorId } = yield* parse(AddComment, input)
      const taskRepo = yield* TaskRepo
      const commentRepo = yield* CommentRepo
      const activityLog = yield* ActivityLog
      const uow = yield* UnitOfWork
      if (!taskRepo.get(taskId)) return yield* new TaskNotFound({ taskId })
      let created!: CommentRecord
      uow.stage(() => {
        created = commentRepo.create({ taskId, body, authorId })
        activityLog.record(`Comment added: ${created.id} on ${taskId}`)
      })
      yield* uow.commit
      return created
    }),
  )
}
