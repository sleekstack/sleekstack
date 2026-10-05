import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { ActivityLog, BoardStore, Clock, IdGen, RequestContext } from '../domain/tags'
import { makeBoardStore } from '../infrastructure/board-store.memory'
import { Board } from './board'

const setup = () => {
  const store = makeBoardStore({
    projects: [{ id: 'p1', name: 'Launch' }],
    tasks: [{ id: 't1', projectId: 'p1', title: 'Ship', status: 'todo', createdAt: 0 }],
    comments: [],
  })
  const log: string[] = []
  let seq = 0
  const env = Layer.mergeAll(
    Layer.succeed(BoardStore, store),
    Layer.succeed(ActivityLog, { record: (m: string) => void log.push(m), list: () => [] }),
    Layer.succeed(Clock, { now: () => 42 }),
    Layer.succeed(IdGen, { next: (p: string) => `${p}_${++seq}` }),
    Layer.succeed(RequestContext, { requestId: 'req', user: { id: 'u', name: 'U' } }),
  )
  const run = <A, E>(e: Effect.Effect<A, E, any>) =>
    Effect.runPromise(Effect.either(Effect.provide(e, env) as Effect.Effect<A, E>))
  const tasks = () => Effect.runPromise(store.tasksOf('p1'))
  const comments = () => Effect.runPromise(store.commentsOf('t1'))
  return { run, tasks, comments, log }
}

describe('Board', () => {
  it('exposes exactly four operations', () => {
    expect(Object.keys(Board).sort()).toEqual(['addComment', 'createTask', 'loadBoard', 'moveTask'])
  })

  it('createTask uses Clock and IdGen, commits, then audits', async () => {
    const { run, tasks, log } = setup()
    const r = await run(Board.createTask({ projectId: 'p1', title: ' New ' }))
    expect(r).toMatchObject({ _tag: 'Right', right: { id: 'task_1', title: 'New', createdAt: 42 } })
    expect(await tasks()).toHaveLength(2)
    expect(log).toEqual(['Task created: task_1 "New"'])
  })

  it.each([
    ['TaskNotFound', Board.moveTask({ taskId: 'nope', status: 'done' })],
    ['TaskNotFound', Board.addComment({ taskId: 'nope', body: 'hi', authorId: 'u' })],
    ['InvalidInput', Board.createTask({ projectId: 'p1', title: '  ' })],
    ['InvalidInput', Board.addComment({ taskId: 't1', body: ' ', authorId: 'u' })],
    ['SimulatedFailure', Board.createTask({ projectId: 'p1', title: 'x', simulateFailure: true })],
  ] as const)('%s leaves the store untouched and writes no audit entry', async (tag, op) => {
    const { run, tasks, comments, log } = setup()
    const r = await run(op as Effect.Effect<unknown, { _tag: string }, any>)
    expect(r).toMatchObject({ _tag: 'Left', left: { _tag: tag } })
    expect(await tasks()).toEqual([{ id: 't1', projectId: 'p1', title: 'Ship', status: 'todo', createdAt: 0 }])
    expect(await comments()).toEqual([])
    expect(log).toEqual([])
  })
})
