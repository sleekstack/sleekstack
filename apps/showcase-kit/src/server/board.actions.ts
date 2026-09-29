'use server'
/**
 * apps/showcase-kit/src/server/board.actions.ts
 *
 * The board's Server Actions. Each is one literal `async function` export (Next's `'use server'`
 * transform only recognizes that literal shape, not a const bound to another function's return
 * value) whose body calls a `defineEffect` generator: `yield*` each Tag it needs,
 * validate, stage a write through UnitOfWork, commit last. Expected failures use kit `fail()` and
 * come back as `{ ok: false, error }`; anything else throws to error.tsx.
 */
import { defineEffect, fail } from '@sleekstack/kit/next'
import { ActivityLog, CommentRepo, TaskRepo, type CommentRecord, type TaskRecord, type TaskStatus } from '../domain/tags'
import { RequestContext, UnitOfWork } from './request.server'
import { demoLayers } from './demo.server'

const boardWriteDeps = [RequestContext, TaskRepo, ActivityLog, UnitOfWork] as const
const addCommentDeps = [RequestContext, TaskRepo, CommentRepo, ActivityLog, UnitOfWork] as const
const demoProvide = { provide: demoLayers }

export interface CreateTaskInput {
  readonly projectId: string
  readonly title: string
  readonly simulateFailure?: boolean
}

const createTaskEffect = defineEffect(function* (input: CreateTaskInput) {
  const tasks = yield* TaskRepo
  const log = yield* ActivityLog
  const uow = yield* UnitOfWork
  const title = input.title.trim()
  if (!title) fail('Task title cannot be empty')
  let created!: TaskRecord
  uow.stage(() => {
    created = tasks.create({ projectId: input.projectId, title })
    log.record(`Task created: ${created.id} "${created.title}"`)
  })
  if (input.simulateFailure) fail('Simulated failure: create rejected before commit')
  uow.commit()
  return created
}, boardWriteDeps, demoProvide)

export async function createTask(input: CreateTaskInput) {
  return createTaskEffect(input)
}

export interface MoveTaskInput {
  readonly taskId: string
  readonly status: TaskStatus
}

const moveTaskEffect = defineEffect(function* (input: MoveTaskInput) {
  const tasks = yield* TaskRepo
  const log = yield* ActivityLog
  const uow = yield* UnitOfWork
  if (!tasks.get(input.taskId)) fail(`Unknown task id: ${input.taskId}`)
  let moved!: TaskRecord
  uow.stage(() => {
    moved = tasks.move(input.taskId, input.status)
    log.record(`Task moved: ${moved.id} -> ${moved.status}`)
  })
  uow.commit()
  return moved
}, boardWriteDeps, demoProvide)

export async function moveTask(input: MoveTaskInput) {
  return moveTaskEffect(input)
}

export interface AddCommentInput {
  readonly taskId: string
  readonly body: string
  readonly authorId: string
}

const addCommentEffect = defineEffect(function* (input: AddCommentInput) {
  const tasks = yield* TaskRepo
  const comments = yield* CommentRepo
  const log = yield* ActivityLog
  const uow = yield* UnitOfWork
  const body = input.body.trim()
  if (!body) fail('Comment body cannot be empty')
  if (!tasks.get(input.taskId)) fail(`Unknown task id: ${input.taskId}`)
  let created!: CommentRecord
  uow.stage(() => {
    created = comments.create({ taskId: input.taskId, body, authorId: input.authorId })
    log.record(`Comment added: ${created.id} on ${input.taskId}`)
  })
  uow.commit()
  return created
}, addCommentDeps, demoProvide)

export async function addComment(input: AddCommentInput) {
  return addCommentEffect(input)
}

/** Every deps list a Server Action in this file resolves; graph.test.ts checks each against AppModule. */
export const boardActionDeps = [createTaskEffect.deps, moveTaskEffect.deps, addCommentEffect.deps] as const
