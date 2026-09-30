import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { CommentRepo, ProjectRepo, TaskRepo } from '../domain/tags'
import { resolveDraft, submitDraft } from './contracts'
import { NewTaskDraft, TaskCommentDraft } from './task'
import { loadBoardModels } from './task.server'

describe('resolveDraft / submitDraft', () => {
  const ctx = { projectId: 'p1' }
  it('resolves a valid draft to the wire body', async () => {
    await expect(Effect.runPromise(resolveDraft(NewTaskDraft, { title: ' A ', simulateFailure: false }, ctx))).resolves.toEqual({
      projectId: 'p1',
      title: 'A',
      simulateFailure: false,
    })
  })
  it('fails with DraftInvalid carrying the designed messages, and never calls send', async () => {
    const send = vi.fn()
    const r = await submitDraft(NewTaskDraft, { title: ' ', simulateFailure: false }, ctx, send)
    expect(r).toEqual({ ok: false, error: 'Please enter a title' })
    expect(send).not.toHaveBeenCalled()
  })
  it('hands the resolved body to send and returns its result', async () => {
    const send = vi.fn(async (dto: { body: string }) => ({ ok: true as const, data: dto.body }))
    const r = await submitDraft(TaskCommentDraft, { body: ' hi ' }, { taskId: 't1', authorId: 'u' }, send)
    expect(r).toEqual({ ok: true, data: 'hi' })
    expect(send).toHaveBeenCalledWith({ taskId: 't1', authorId: 'u', body: 'hi' })
  })
})

describe('loadBoardModels', () => {
  it('resolves Models with project names from the repos', async () => {
    const board = await Effect.runPromise(
      loadBoardModels.pipe(
        Effect.provideService(ProjectRepo, { list: () => [{ id: 'p1', name: 'Launch' }], get: () => undefined }),
        Effect.provideService(TaskRepo, {
          listByProject: () => [{ id: 't1', projectId: 'p1', title: 'Ship', status: 'done', createdAt: 0 }],
          get: () => undefined,
          create: () => { throw new Error('unused') },
          move: () => { throw new Error('unused') },
        }),
        Effect.provideService(CommentRepo, {
          listByTask: () => [{ id: 'c1', taskId: 't1', body: 'ok', authorId: 'u', createdAt: 0 }],
          create: () => { throw new Error('unused') },
        }),
      ),
    )
    expect(board[0]!.tasks[0]!.task).toMatchObject({ statusLabel: 'Done', projectName: 'Launch' })
    expect(board[0]!.tasks[0]!.comments[0]).toMatchObject({ id: 'c1', createdAtIso: '1970-01-01T00:00:00.000Z' })
  })
})
