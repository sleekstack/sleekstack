import { Effect, Exit } from 'effect'
import { describe, expect, it } from 'vitest'
import type { BoardStoreService } from '../domain/tags'
import { makeBoardStore } from './board-store.memory'

const fresh = () =>
  makeBoardStore({
    projects: [{ id: 'p1', name: 'Launch' }],
    tasks: [{ id: 't1', projectId: 'p1', title: 'Ship', status: 'todo', createdAt: 0 }],
    comments: [{ id: 'c1', taskId: 't1', body: 'ok', authorId: 'u', createdAt: 0 }],
  })

const snapshot = (store: BoardStoreService) =>
  Effect.all({ projects: store.projects(), tasks: store.tasksOf('p1'), comments: store.commentsOf('t1') })

describe('BoardStore (in memory)', () => {
  it('a failing transaction leaves projects, tasks and comments unchanged', async () => {
    const store = fresh()
    const before = await Effect.runPromise(snapshot(store))
    const exit = await Effect.runPromiseExit(
      store.transaction((tx) =>
        Effect.all([
          tx.createTask({ id: 't2', projectId: 'p1', title: 'New', status: 'todo', createdAt: 1 }),
          tx.moveTask('t1', 'done'),
          tx.addComment({ id: 'c2', taskId: 't1', body: 'x', authorId: 'u', createdAt: 1 }),
          // a read on tx sees its own writes
          Effect.flatMap(tx.task('t2'), (t) => Effect.sync(() => expect(t.title).toBe('New'))),
          Effect.fail('boom' as const),
        ]),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    expect(await Effect.runPromise(snapshot(store))).toEqual(before)
  })

  it('a failing transaction overlapping a successful one keeps the successful write', async () => {
    const store = fresh()
    const failing = store.transaction((tx) =>
      Effect.zipRight(
        tx.moveTask('t1', 'in_progress'),
        Effect.zipRight(Effect.sleep('10 millis'), Effect.fail('boom' as const)),
      ),
    )
    const succeeding = store.transaction((tx) => tx.moveTask('t1', 'done'))
    const [failed] = await Effect.runPromise(
      Effect.all([Effect.exit(failing), Effect.delay(succeeding, '1 millis')], { concurrency: 'unbounded' }),
    )
    expect(Exit.isFailure(failed)).toBe(true)
    expect((await Effect.runPromise(store.task('t1'))).status).toBe('done')
  })

  it('a BoardTx kept past its transaction cannot write committed state', async () => {
    const store = fresh()
    const escaped = await Effect.runPromise(store.transaction((tx) => Effect.succeed(tx)))
    await Effect.runPromise(escaped.moveTask('t1', 'done'))
    expect((await Effect.runPromise(store.task('t1'))).status).toBe('todo')
  })
})
