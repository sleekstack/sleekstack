/**
 * apps/showcase/src/__tests__/requests.test.ts
 *
 * Request scopes are isolated and finalized in order, BoardStore transactions commit
 * atomically (a simulated or validation failure leaves the Store untouched),
 * the activity log shows request open/close in order, a defect is reported to
 * the log and still rejects, and demo-mode shadowing swaps the ActivityLog for the mock.
 */
import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import { ActivityLog, BoardStore } from '../domain/tags'
import { __setDemoCookie } from '../test/next-headers-stub'
import { runApp } from '../delivery/runtime.server'
import type { AddCommentInput, CreateTaskInput, MoveTaskInput } from '../delivery/actions'

const countTasks = (projectId: string) =>
  runApp(Effect.flatMap(BoardStore, (store) => Effect.map(store.tasksOf(projectId), (tasks) => tasks.length)))

const logMessages = () => runApp(Effect.map(ActivityLog, (activityLog) => activityLog.list().map((e) => e.message)))

describe('showcase request scopes', () => {
  it('20 concurrent createTask calls open 20 distinct request ids, all commit, and none cross-talk', async () => {
    const { createTask } = await import('../delivery/actions')
    const before = await countTasks('proj_1')
    const beforeLog = await logMessages()
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createTask({ projectId: 'proj_1', title: `Concurrent task ${i}` } satisfies CreateTaskInput),
      ),
    )
    for (const result of results) expect(result.ok).toBe(true)
    const taskIds = results.map((r) => (r.ok ? r.data.id : undefined))
    expect(new Set(taskIds).size).toBe(20) // 20 distinct tasks were actually created (no lost writes)...

    // Capture the log right after the 20 creates (before any further query adds its own
    // open/close pair) so this slice contains exactly their 20 request scopes.
    const added = (await logMessages()).slice(beforeLog.length)
    expect(await countTasks('proj_1')).toBe(before + 20)

    // Each create ran in its own request scope: 20 distinct request ids that each got both
    // an "opened" and a matching "closed" (no cross-talk between concurrent requests).
    const closedIds = new Set<string>()
    const seenOpen = new Set<string>()
    for (const message of added) {
      const opened = message.match(/^request (\S+) opened$/)?.[1]
      if (opened) seenOpen.add(opened)
      const closed = message.match(/^request (\S+) closed$/)?.[1]
      if (closed && seenOpen.has(closed)) closedIds.add(closed)
    }
    expect(closedIds.size).toBe(20)
  })

  it('an empty title is rejected with a descriptive error; the store is unchanged', async () => {
    const { createTask } = await import('../delivery/actions')
    const before = await countTasks('proj_1')
    const result = await createTask({ projectId: 'proj_1', title: '   ' } satisfies CreateTaskInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/title cannot be empty/i)
    expect(await countTasks('proj_1')).toBe(before)
  })

  it('moving an unknown task id is rejected with a descriptive error', async () => {
    const { moveTask } = await import('../delivery/actions')
    const result = await moveTask({ taskId: 'no-such-task', status: 'done' } satisfies MoveTaskInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unknown task id/i)
  })

  it('adding a comment to an unknown task id is rejected with a descriptive error', async () => {
    const { addComment } = await import('../delivery/actions')
    const result = await addComment({
      taskId: 'no-such-task',
      body: 'hi',
      authorId: 'user_1',
    } satisfies AddCommentInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unknown task id/i)
  })

  it('a simulated failure rejects after staging but before commit: the store is unchanged', async () => {
    const { createTask } = await import('../delivery/actions')
    const before = await countTasks('proj_1')
    const result = await createTask({
      projectId: 'proj_1',
      title: 'Should not persist',
      simulateFailure: true,
    } satisfies CreateTaskInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/simulated failure/i)
    expect(await countTasks('proj_1')).toBe(before)
  })

  it('a successful create commits exactly once', async () => {
    const { createTask } = await import('../delivery/actions')
    const before = await countTasks('proj_1')
    const result = await createTask({ projectId: 'proj_1', title: 'Commits once' } satisfies CreateTaskInput)
    expect(result.ok).toBe(true)
    expect(await countTasks('proj_1')).toBe(before + 1)
  })

  it('a transaction whose second write fails applies nothing (atomic)', async () => {
    const before = await countTasks('proj_1')
    const op = runApp(
      Effect.flatMap(BoardStore, (store) =>
        store.transaction((tx) =>
          Effect.zipRight(
            tx.createTask({
              id: 'task_half',
              projectId: 'proj_1',
              title: 'Half-applied',
              status: 'todo',
              createdAt: 0,
            }),
            tx.moveTask('no-such-task', 'done'),
          ),
        ),
      ),
    )
    await expect(op).rejects.toThrow(/unknown task id/i)
    expect(await countTasks('proj_1')).toBe(before)
  })

  it('a defect rejects the operation and is reported to the console and the activity log', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(runApp(Effect.die('kaboom'))).rejects.toThrow()
      expect(spy.mock.calls.filter((c) => String(c[0]).includes('kaboom'))).toHaveLength(1)
      expect((await logMessages()).some((m) => m.includes('kaboom'))).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })

  it('act maps a DomainError to { ok: false } and rejects on a defect', async () => {
    const { act } = await import('../delivery/act.server')
    const { InvalidInput } = await import('../domain/errors')
    await expect(act(() => Effect.fail(new InvalidInput({ message: 'nope' })))(undefined)).resolves.toEqual({
      ok: false,
      error: 'nope',
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(act(() => Effect.die('act-defect'))(undefined)).rejects.toThrow()
    } finally {
      spy.mockRestore()
    }
  })

  it('the log shows request open and close, in order and with matching ids, for a single call', async () => {
    const { createTask } = await import('../delivery/actions')
    const result = await createTask({ projectId: 'proj_1', title: 'Logged request' } satisfies CreateTaskInput)
    expect(result.ok).toBe(true)
    const events = await logMessages()
    // The request's own open is logged as the scope builds (before the body runs), and its
    // close as the scope's finalizer (right after) — so they flank the "Task created" entry.
    const createdIndex = events.findIndex((m) => m.includes('"Logged request"'))
    expect(createdIndex).toBeGreaterThan(0)
    const opened = events[createdIndex - 1]!
    const closed = events[createdIndex + 1]!
    expect(opened).toMatch(/^request \S+ opened$/)
    expect(closed).toMatch(/^request \S+ closed$/)
    expect(opened.match(/request (\S+) opened/)?.[1]).toBe(closed.match(/request (\S+) closed/)?.[1])
  })

  it('demo mode shadows ActivityLog with the mock: the real log never sees the call', async () => {
    const { createTask } = await import('../delivery/actions')
    const { __peekMockActivityEvents } = await import('../infrastructure/demo.live')
    const beforeMock = __peekMockActivityEvents().length
    __setDemoCookie('1')
    let result: Awaited<ReturnType<typeof createTask>>
    try {
      result = await createTask({ projectId: 'proj_1', title: 'Demo task' } satisfies CreateTaskInput)
    } finally {
      __setDemoCookie(undefined)
    }
    expect(result.ok).toBe(true)
    expect(__peekMockActivityEvents().length).toBeGreaterThan(beforeMock)
    expect(__peekMockActivityEvents().some((e) => e.message.includes('Demo task'))).toBe(true)
    const realEvents = await logMessages()
    expect(realEvents.some((m) => m.includes('Demo task'))).toBe(false)
  })

  it('a task created in demo mode carries the overridden Clock timestamp', async () => {
    const { createTask } = await import('../delivery/actions')
    __setDemoCookie('1')
    let result: Awaited<ReturnType<typeof createTask>>
    try {
      result = await createTask({ projectId: 'proj_1', title: 'Demo clock task' } satisfies CreateTaskInput)
    } finally {
      __setDemoCookie(undefined)
    }
    expect(result.ok && result.data.createdAt).toBe(0)
  })
})
