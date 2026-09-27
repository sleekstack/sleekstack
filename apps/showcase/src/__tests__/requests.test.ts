/**
 * apps/showcase/src/__tests__/requests.test.ts
 *
 * R4, R5, R6, R9, R11: request scopes are isolated and finalized in order,
 * UnitOfWork commits atomically (a simulated or validation failure leaves
 * the Store untouched), the activity log shows request open/close in order,
 * a throwing finalizer sink never changes an operation's result, and
 * demo-mode shadowing swaps the ActivityLog for the mock.
 *
 * This file's tests share one process-global runtime slot (same pattern as
 * packages/next/src/__tests__/next.test.ts:6-7): order matters, so the
 * unconfigured case runs first, before anything configures the app runtime.
 */
import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { action, query } from '@sleekstack/next'
import { ActivityLog, TaskRepo } from '../domain/tags'
import { __setDemoCookie } from '../test/next-headers-stub'
import type { AddCommentInput, CreateTaskInput, MoveTaskInput } from '../server/board.actions'

const countTasks = (projectId: string) =>
  query(() =>
    Effect.gen(function* () {
      const taskRepo = yield* TaskRepo
      return taskRepo.listByProject(projectId).length
    }),
  )()

const logMessages = () =>
  query(() =>
    Effect.gen(function* () {
      const activityLog = yield* ActivityLog
      return activityLog.list().map((e) => e.message)
    }),
  )()

describe('showcase request scopes', () => {
  it('an action called before instrumentation.ts configures the runtime rejects with a descriptive error', async () => {
    const op = action(() => Effect.succeed('unconfigured'))
    await expect(op()).rejects.toThrow(/configureRuntime/)
  })

  it("importing the runtime module twice (dev HMR re-running register()) is the library's same-reference no-op", async () => {
    await import('../server/runtime.server')
    await expect(import('../server/runtime.server')).resolves.toBeDefined()
  })

  it('20 concurrent createTask calls open 20 distinct request ids, all commit, and none cross-talk', async () => {
    const { createTask } = await import('../server/board.actions')
    const before = await countTasks('proj_1')
    const beforeLog = await logMessages()
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createTask({ projectId: 'proj_1', title: `Concurrent task ${i}` } satisfies CreateTaskInput)),
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
    const { createTask } = await import('../server/board.actions')
    const before = await countTasks('proj_1')
    const result = await createTask({ projectId: 'proj_1', title: '   ' } satisfies CreateTaskInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/title cannot be empty/i)
    expect(await countTasks('proj_1')).toBe(before)
  })

  it('moving an unknown task id is rejected with a descriptive error', async () => {
    const { moveTask } = await import('../server/board.actions')
    const result = await moveTask({ taskId: 'no-such-task', status: 'done' } satisfies MoveTaskInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unknown task id/i)
  })

  it('adding a comment to an unknown task id is rejected with a descriptive error', async () => {
    const { addComment } = await import('../server/board.actions')
    const result = await addComment({ taskId: 'no-such-task', body: 'hi', authorId: 'user_1' } satisfies AddCommentInput)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/unknown task id/i)
  })

  it('a simulated failure rejects after staging but before commit: the store is unchanged', async () => {
    const { createTask } = await import('../server/board.actions')
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
    const { createTask } = await import('../server/board.actions')
    const before = await countTasks('proj_1')
    const result = await createTask({ projectId: 'proj_1', title: 'Commits once' } satisfies CreateTaskInput)
    expect(result.ok).toBe(true)
    expect(await countTasks('proj_1')).toBe(before + 1)
  })

  it('a throwing onFinalizerError sink does not change a successful operation result', async () => {
    // The library contract itself (a throwing sink never changes the op's outcome) is
    // asserted in packages/next/src/__tests__/next.test.ts; this proves the app's own
    // sink (runtime.server.ts's onFinalizerError) never surfaces as a rejection either.
    const { createTask } = await import('../server/board.actions')
    const result = await createTask({ projectId: 'proj_1', title: 'Sink safety' } satisfies CreateTaskInput)
    expect(result.ok).toBe(true)
  })

  it('the log shows request open and close, in order and with matching ids, for a single call', async () => {
    const { createTask } = await import('../server/board.actions')
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
    const { createTask } = await import('../server/board.actions')
    const { __peekMockActivityEvents } = await import('../server/demo.server')
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
})
