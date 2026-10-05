import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { BoardStore } from '../domain/tags'
import { makeBoardStore } from '../infrastructure/board-store.memory'
import { resolveDraft } from '../lib/contracts'
import { BoardModel, NewTaskDraft, TaskCommentDraft } from '../models/task'
import { loadBoard } from './board-view'

describe('resolveDraft', () => {
  const ctx = { projectId: 'p1' }
  it('resolves a valid draft to the wire body', async () => {
    await expect(
      Effect.runPromise(resolveDraft(NewTaskDraft, { title: ' A ', simulateFailure: false }, ctx)),
    ).resolves.toEqual({
      projectId: 'p1',
      title: 'A',
      simulateFailure: false,
    })
  })
  it('fails with DraftInvalid carrying the designed messages', async () => {
    const r = await Effect.runPromise(
      Effect.flip(resolveDraft(NewTaskDraft, { title: ' ', simulateFailure: false }, ctx)),
    )
    expect(r.messages).toEqual(['Please enter a title'])
  })
})

describe('loadBoard + BoardModel.fromDto', () => {
  it('reads the board DTO and resolves Models with project names from it', async () => {
    const store = makeBoardStore({
      projects: [{ id: 'p1', name: 'Launch' }],
      tasks: [{ id: 't1', projectId: 'p1', title: 'Ship', status: 'done', createdAt: 0 }],
      comments: [{ id: 'c1', taskId: 't1', body: 'ok', authorId: 'u', createdAt: 0 }],
    })
    const dto = await Effect.runPromise(loadBoard.pipe(Effect.provideService(BoardStore, store)))
    expect(dto[0]!.tasks[0]!.task).toMatchObject({ id: 't1', projectId: 'p1', status: 'done' })
    const board = Effect.runSync(BoardModel.fromDto(dto))
    expect(board[0]!.tasks[0]!.task).toMatchObject({ statusLabel: 'Done', projectName: 'Launch' })
    expect(board[0]!.tasks[0]!.comments[0]).toMatchObject({ id: 'c1', createdAtIso: '1970-01-01T00:00:00.000Z' })
  })
})
