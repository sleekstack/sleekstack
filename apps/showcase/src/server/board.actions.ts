'use server'
/**
 * apps/showcase/src/server/board.actions.ts
 *
 * The board's mutating Server Actions (R5): each wraps an inner `action()`
 * operation that validates input, writes inside one BoardStore transaction,
 * and records the audit entry only after that transaction commits. Next production hides thrown server messages, so an
 * expected failure (validation, "simulate failure") is returned as
 * `{ ok: false, error }`, never thrown; only an unexpected defect reaches
 * `error.tsx`.
 */
import { Effect } from 'effect'
import type { z } from 'zod'
import { InvalidInput, SimulatedFailure, type DomainError } from '../domain/errors'
import { AddComment, CreateTask, MoveTask } from '../domain/inputs'
import { ActivityLog, BoardStore, Clock, IdGen, type CommentRecord, type TaskRecord } from '../domain/tags'
import { RequestContext } from './request.server'
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
      const store = yield* BoardStore
      const record: TaskRecord = {
        id: (yield* IdGen).next('task'),
        projectId,
        title,
        status: 'todo',
        createdAt: (yield* Clock).now(),
      }
      const created = yield* store.transaction((tx) =>
        Effect.flatMap(tx.createTask(record), (task) =>
          simulateFailure ? new SimulatedFailure({ message: 'Simulated failure: create rejected before commit' }) : Effect.succeed(task)),
      )
      ;(yield* ActivityLog).record(`Task created: ${created.id} "${created.title}"`)
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
      const store = yield* BoardStore
      const moved = yield* store.transaction((tx) => tx.moveTask(taskId, status))
      ;(yield* ActivityLog).record(`Task moved: ${moved.id} -> ${moved.status}`)
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
      const store = yield* BoardStore
      const record: CommentRecord = { id: (yield* IdGen).next('comment'), taskId, body, authorId, createdAt: (yield* Clock).now() }
      const created = yield* store.transaction((tx) => tx.addComment(record))
      ;(yield* ActivityLog).record(`Comment added: ${created.id} on ${taskId}`)
      return created
    }),
  )
}
