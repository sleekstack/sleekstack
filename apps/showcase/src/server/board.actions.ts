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
import { action } from '@sleekstack/next'
import { Effect } from 'effect'
import { ActivityLog, CommentRepo, TaskRepo, type CommentRecord, type TaskRecord, type TaskStatus } from '../domain/tags'
import { RequestContext, UnitOfWork } from './request.server'
import { demoEntries } from './demo.server'

export type ActionResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string }

async function toResult<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export interface CreateTaskInput {
  readonly projectId: string
  readonly title: string
  readonly simulateFailure?: boolean
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult<TaskRecord>> {
  const provide = await demoEntries()
  const createTaskOp = action({ provide }, (i: CreateTaskInput) =>
    Effect.gen(function* () {
      yield* RequestContext
      const title = i.title.trim()
      if (!title) return yield* Effect.fail(new Error('Task title cannot be empty'))
      const taskRepo = yield* TaskRepo
      const activityLog = yield* ActivityLog
      const uow = yield* UnitOfWork
      let created!: TaskRecord
      uow.stage(() => {
        created = taskRepo.create({ projectId: i.projectId, title })
        activityLog.record(`Task created: ${created.id} "${created.title}"`)
      })
      if (i.simulateFailure) return yield* Effect.fail(new Error('Simulated failure: create rejected before commit'))
      yield* uow.commit
      return created
    }),
  )
  return toResult(() => createTaskOp(input))
}

export interface MoveTaskInput {
  readonly taskId: string
  readonly status: TaskStatus
}

export async function moveTask(input: MoveTaskInput): Promise<ActionResult<TaskRecord>> {
  const provide = await demoEntries()
  const moveTaskOp = action({ provide }, (i: MoveTaskInput) =>
    Effect.gen(function* () {
      yield* RequestContext
      const taskRepo = yield* TaskRepo
      const activityLog = yield* ActivityLog
      const uow = yield* UnitOfWork
      const existing = taskRepo.get(i.taskId)
      if (!existing) return yield* Effect.fail(new Error(`Unknown task id: ${i.taskId}`))
      let moved!: TaskRecord
      uow.stage(() => {
        moved = taskRepo.move(i.taskId, i.status)
        activityLog.record(`Task moved: ${moved.id} -> ${moved.status}`)
      })
      yield* uow.commit
      return moved
    }),
  )
  return toResult(() => moveTaskOp(input))
}

export interface AddCommentInput {
  readonly taskId: string
  readonly body: string
  readonly authorId: string
}

export async function addComment(input: AddCommentInput): Promise<ActionResult<CommentRecord>> {
  const provide = await demoEntries()
  const addCommentOp = action({ provide }, (i: AddCommentInput) =>
    Effect.gen(function* () {
      yield* RequestContext
      const body = i.body.trim()
      if (!body) return yield* Effect.fail(new Error('Comment body cannot be empty'))
      const taskRepo = yield* TaskRepo
      const commentRepo = yield* CommentRepo
      const activityLog = yield* ActivityLog
      const uow = yield* UnitOfWork
      const existing = taskRepo.get(i.taskId)
      if (!existing) return yield* Effect.fail(new Error(`Unknown task id: ${i.taskId}`))
      let created!: CommentRecord
      uow.stage(() => {
        created = commentRepo.create({ taskId: i.taskId, body, authorId: i.authorId })
        activityLog.record(`Comment added: ${created.id} on ${i.taskId}`)
      })
      yield* uow.commit
      return created
    }),
  )
  return toResult(() => addCommentOp(input))
}
