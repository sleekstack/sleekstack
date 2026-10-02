import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { BoardStore } from '../domain/tags'
import { makeBoardStore } from '../infrastructure/board-store.memory'
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
  it('resolves Models with project names from the store', async () => {
    const store = makeBoardStore({
      projects: [{ id: 'p1', name: 'Launch' }],
      tasks: [{ id: 't1', projectId: 'p1', title: 'Ship', status: 'done', createdAt: 0 }],
      comments: [{ id: 'c1', taskId: 't1', body: 'ok', authorId: 'u', createdAt: 0 }],
    })
    const board = await Effect.runPromise(loadBoardModels.pipe(Effect.provideService(BoardStore, store)))
    expect(board[0]!.tasks[0]!.task).toMatchObject({ statusLabel: 'Done', projectName: 'Launch' })
    expect(board[0]!.tasks[0]!.comments[0]).toMatchObject({ id: 'c1', createdAtIso: '1970-01-01T00:00:00.000Z' })
  })

  it('builds the project-name lookup once per load, however many tasks', async () => {
    const tasks = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, projectId: 'p1', title: 'x', status: 'todo' as const, createdAt: 0 }))
    const store = makeBoardStore({ projects: [{ id: 'p1', name: 'Launch' }], tasks, comments: [] })
    const projects = vi.fn(store.projects)
    await Effect.runPromise(loadBoardModels.pipe(Effect.provideService(BoardStore, { ...store, projects })))
    // once by the loader itself, once by the ProjectNames layer; not once per task
    expect(projects).toHaveBeenCalledTimes(2)
  })
})
