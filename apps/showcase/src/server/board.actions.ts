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
import { Data, Effect } from 'effect'
import { ActivityLog, CommentRepo, TaskRepo, type CommentRecord, type TaskRecord, type TaskStatus } from '../domain/tags'
import { RequestContext, UnitOfWork } from './request.server'
import { runApp } from './runtime.server'

export type ActionResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string }

/**
 * A modeled, expected failure (validation, "simulate failure"): only this
 * becomes `{ ok: false, error }`. A defect or finalizer failure rejects, so it
 * reaches `error.tsx` instead of being reported as a normal result.
 */
class ExpectedFailure extends Data.TaggedError('ExpectedFailure')<{ readonly message: string }> {}

const fail = (message: string) => Effect.fail(new ExpectedFailure({ message }))

const toResult = <T>(program: Effect.Effect<T, ExpectedFailure, any>): Promise<ActionResult<T>> =>
  runApp(
    program.pipe(
      Effect.map((data): ActionResult<T> => ({ ok: true, data })),
      Effect.catchTag('ExpectedFailure', (e) => Effect.succeed<ActionResult<T>>({ ok: false, error: e.message })),
    ),
  )

export interface CreateTaskInput {
  readonly projectId: string
  readonly title: string
  readonly simulateFailure?: boolean
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult<TaskRecord>> {
  return toResult(
    Effect.gen(function* () {
      yield* RequestContext
      const title = input.title.trim()
      if (!title) return yield* fail('Task title cannot be empty')
      const taskRepo = yield* TaskRepo
      const activityLog = yield* ActivityLog
      const uow = yield* UnitOfWork
      let created!: TaskRecord
      uow.stage(() => {
        created = taskRepo.create({ projectId: input.projectId, title })
        activityLog.record(`Task created: ${created.id} "${created.title}"`)
      })
      if (input.simulateFailure) return yield* fail('Simulated failure: create rejected before commit')
      yield* uow.commit
      return created
    }),
  )
}

export interface MoveTaskInput {
  readonly taskId: string
  readonly status: TaskStatus
}

export async function moveTask(input: MoveTaskInput): Promise<ActionResult<TaskRecord>> {
  return toResult(
    Effect.gen(function* () {
      yield* RequestContext
      const taskRepo = yield* TaskRepo
      const activityLog = yield* ActivityLog
      const uow = yield* UnitOfWork
      const existing = taskRepo.get(input.taskId)
      if (!existing) return yield* fail(`Unknown task id: ${input.taskId}`)
      let moved!: TaskRecord
      uow.stage(() => {
        moved = taskRepo.move(input.taskId, input.status)
        activityLog.record(`Task moved: ${moved.id} -> ${moved.status}`)
      })
      yield* uow.commit
      return moved
    }),
  )
}

export interface AddCommentInput {
  readonly taskId: string
  readonly body: string
  readonly authorId: string
}

export async function addComment(input: AddCommentInput): Promise<ActionResult<CommentRecord>> {
  return toResult(
    Effect.gen(function* () {
      yield* RequestContext
      const body = input.body.trim()
      if (!body) return yield* fail('Comment body cannot be empty')
      const taskRepo = yield* TaskRepo
      const commentRepo = yield* CommentRepo
      const activityLog = yield* ActivityLog
      const uow = yield* UnitOfWork
      const existing = taskRepo.get(input.taskId)
      if (!existing) return yield* fail(`Unknown task id: ${input.taskId}`)
      let created!: CommentRecord
      uow.stage(() => {
        created = commentRepo.create({ taskId: input.taskId, body, authorId: input.authorId })
        activityLog.record(`Comment added: ${created.id} on ${input.taskId}`)
      })
      yield* uow.commit
      return created
    }),
  )
}
