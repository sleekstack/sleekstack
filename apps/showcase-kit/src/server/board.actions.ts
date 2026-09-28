'use server'
/**
 * apps/showcase-kit/src/server/board.actions.ts
 *
 * The board's Server Actions. Each validates, stages its write through
 * UnitOfWork and commits last. Expected failures use kit `fail()` and come
 * back as `{ ok: false, error }`; anything else throws to error.tsx.
 */
import { action, fail, type ActionResult } from '@sleekstack/kit/next'
import { ActivityLog, CommentRepo, TaskRepo, type CommentRecord, type TaskRecord, type TaskStatus } from '../domain/tags'
import { RequestContext, UnitOfWork } from './request.server'
import { demoLayers } from './demo.server'

export interface CreateTaskInput {
  readonly projectId: string
  readonly title: string
  readonly simulateFailure?: boolean
}

export async function createTask(input: CreateTaskInput): Promise<ActionResult<TaskRecord>> {
  const op = action((_rc, tasks, log, uow) => (i: CreateTaskInput) => {
    const title = i.title.trim()
    if (!title) fail('Task title cannot be empty')
    let created!: TaskRecord
    uow.stage(() => {
      created = tasks.create({ projectId: i.projectId, title })
      log.record(`Task created: ${created.id} "${created.title}"`)
    })
    if (i.simulateFailure) fail('Simulated failure: create rejected before commit')
    uow.commit()
    return created
  }, [RequestContext, TaskRepo, ActivityLog, UnitOfWork], { provide: await demoLayers() })
  return op(input)
}

export interface MoveTaskInput {
  readonly taskId: string
  readonly status: TaskStatus
}

export async function moveTask(input: MoveTaskInput): Promise<ActionResult<TaskRecord>> {
  const op = action((_rc, tasks, log, uow) => (i: MoveTaskInput) => {
    if (!tasks.get(i.taskId)) fail(`Unknown task id: ${i.taskId}`)
    let moved!: TaskRecord
    uow.stage(() => {
      moved = tasks.move(i.taskId, i.status)
      log.record(`Task moved: ${moved.id} -> ${moved.status}`)
    })
    uow.commit()
    return moved
  }, [RequestContext, TaskRepo, ActivityLog, UnitOfWork], { provide: await demoLayers() })
  return op(input)
}

export interface AddCommentInput {
  readonly taskId: string
  readonly body: string
  readonly authorId: string
}

export async function addComment(input: AddCommentInput): Promise<ActionResult<CommentRecord>> {
  const op = action((_rc, tasks, comments, log, uow) => (i: AddCommentInput) => {
    const body = i.body.trim()
    if (!body) fail('Comment body cannot be empty')
    if (!tasks.get(i.taskId)) fail(`Unknown task id: ${i.taskId}`)
    let created!: CommentRecord
    uow.stage(() => {
      created = comments.create({ taskId: i.taskId, body, authorId: i.authorId })
      log.record(`Comment added: ${created.id} on ${i.taskId}`)
    })
    uow.commit()
    return created
  }, [RequestContext, TaskRepo, CommentRepo, ActivityLog, UnitOfWork], { provide: await demoLayers() })
  return op(input)
}
