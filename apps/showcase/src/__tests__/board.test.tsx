/**
 * apps/showcase/src/__tests__/board.test.tsx
 *
 * R6/R7/R8: the client board under StrictMode. `next/navigation` is mocked
 * (no App Router context under RTL) and `delivery/actions.ts`'s Server Actions
 * are mocked (`readBoard` serves the board query's fetch), so these are pure
 * component tests of the LayerProvider nesting, scope-log ordering, the
 * "break detail" error boundary and the board's cache-backed mutations.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderToPipeableStream } from 'react-dom/server'
import { PassThrough } from 'node:stream'
import { Suspense, useSyncExternalStore, type ReactNode } from 'react'
import { LayerProvider, useAtomValue, useService } from '@sleekstack/react'
import { renderStrict } from './renderStrict'
import { Board } from '../client/components/Board'
import { Providers } from '../../app/providers'
import { scopeLog } from '../client/components/ScopeLog'
import { DraftEditorPanel } from '../client/components/TaskDetail'
import { DraftEditor, makeDraftEditorLayer, selectionMemory } from '../client/services/component-services'

/**
 * A real (streaming) SSR pass, unlike jsdom RTL rendering: `renderToPipeableStream`
 * waits out Suspense the way Next's SSR does, so a component service that
 * resolves mid-render is re-rendered with its resolved value — the render
 * path that actually hit "Missing getServerSnapshot" in `next dev` (RTL's
 * `render`/`renderToString` never wait for a suspended promise to resolve).
 */
function ssrRender(node: ReactNode): Promise<{ errors: string[] }> {
  const errors: string[] = []
  return new Promise((resolve, reject) => {
    const { pipe } = renderToPipeableStream(node, {
      onShellError: reject,
      onError(error) {
        errors.push(String(error))
      },
      onAllReady() {
        pipe(new PassThrough())
        resolve({ errors })
      },
    })
  })
}

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const actions = vi.hoisted(() => {
  const task = (id: string, projectId: string, title: string) => ({ task: { id, projectId, title, status: 'todo' as const, createdAt: 0 }, comments: [] })
  const dto = [
    { project: { id: 'p1', name: 'Alpha' }, tasks: [task('t1', 'p1', 'Write spec')] },
    { project: { id: 'p2', name: 'Beta' }, tasks: [task('t2', 'p2', 'Ship it')] },
  ]
  return { task, dto, readBoard: vi.fn(), createTask: vi.fn(), moveTask: vi.fn(), addComment: vi.fn() }
})
vi.mock('../delivery/actions', () => actions)

beforeEach(() => {
  scopeLog.reset()
  selectionMemory.clear()
  refresh.mockClear()
  actions.readBoard.mockImplementation(async () => actions.dto)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// Scope acquisition runs through the Effect runtime; the first render in a cold
// CI worker (module transform + runtime init) can exceed findBy*'s 1 s default.
const SCOPE_LOAD_TIMEOUT = 5000

const messages = () => scopeLog.list().map((e) => e.message)

describe('Board — R7/R8 nested component scopes', () => {
  it('opening task detail logs 1 acquire; closing (full unmount) logs 1 release, child before project', async () => {
    const { unmount } = renderStrict(
      <Providers demoMode={false}>
        <Board demoMode={false} />
      </Providers>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /write spec/i }, { timeout: SCOPE_LOAD_TIMEOUT }))

    await waitFor(() => {
      expect(messages().filter((m) => m.startsWith('acquire: DraftEditor (t1)'))).toHaveLength(1)
    })

    unmount()

    await waitFor(() => {
      expect(messages().filter((m) => m.startsWith('release: DraftEditor (t1)'))).toHaveLength(1)
      expect(messages().filter((m) => m.startsWith('release: ProjectFilterStore (p1)'))).toHaveLength(1)
    })
    const draftReleaseIdx = messages().findIndex((m) => m.startsWith('release: DraftEditor (t1)'))
    const projectReleaseIdx = messages().findIndex((m) => m.startsWith('release: ProjectFilterStore (p1)'))
    expect(draftReleaseIdx).toBeLessThan(projectReleaseIdx)
  })

  it('a failing detail acquisition shows the error boundary; the project and sibling stay mounted', async () => {
    renderStrict(
      <Providers demoMode={false}>
        <Board demoMode={false} />
      </Providers>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /write spec/i }, { timeout: SCOPE_LOAD_TIMEOUT }))
    await screen.findByLabelText(/task detail: write spec/i, {}, { timeout: SCOPE_LOAD_TIMEOUT })

    fireEvent.click(screen.getByLabelText(/break detail/i))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/DraftEditor acquisition failed for task t1/)
    })

    // The failing subtree's own project stays mounted (create-task form still there)...
    const alphaProject = screen.getByRole('region', { name: /project: alpha/i })
    expect(within(alphaProject).getByRole('button', { name: /create task/i })).not.toBeNull()
    // ...and the sibling project's task list is untouched.
    expect(await screen.findByRole('button', { name: /ship it/i }, { timeout: SCOPE_LOAD_TIMEOUT })).not.toBeNull()
  })

  it('the demo toggle triggers a refresh; a new demoMode key releases the old scopes and remounts the open detail', async () => {
    const { rerender } = renderStrict(
      <Providers demoMode={false}>
        <Board demoMode={false} />
      </Providers>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /write spec/i }, { timeout: SCOPE_LOAD_TIMEOUT }))
    await waitFor(() => expect(messages().some((m) => m.startsWith('acquire: DraftEditor (t1)'))).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: /enter demo mode/i }))
    expect(refresh).toHaveBeenCalledTimes(1)

    // Simulates the server round-trip `router.refresh()` triggers: the server
    // re-reads the cookie and passes the new `demoMode` down, changing the
    // app LayerProvider's `key` (providers.tsx) and remounting the tree.
    rerender(
      <Providers demoMode={true}>
        <Board demoMode={true} />
      </Providers>,
    )

    await waitFor(() => {
      expect(messages().filter((m) => m.startsWith('release: DraftEditor (t1)'))).toHaveLength(1)
      expect(messages().filter((m) => m.startsWith('release: ProjectFilterStore (p1)'))).toHaveLength(1)
      expect(messages().filter((m) => m.startsWith('acquire: DraftEditor (t1)'))).toHaveLength(2)
    })
    // Released under the old scope, then acquired again under the new one: a remount, not a close.
    const releaseIdx = messages().findIndex((m) => m.startsWith('release: DraftEditor (t1)'))
    const reacquireIdx = messages().findLastIndex((m) => m.startsWith('acquire: DraftEditor (t1)'))
    expect(releaseIdx).toBeLessThan(reacquireIdx)
    expect(await screen.findByLabelText(/task detail: write spec/i, {}, { timeout: SCOPE_LOAD_TIMEOUT })).not.toBeNull()
  })

  it('renders server-side without a "Missing getServerSnapshot" bailout (and the Clock FiberFailure it causes)', async () => {
    // `next dev`'s real bug (found in manual testing): the server streams past
    // ProjectView's Suspense fallback once its component service resolves,
    // re-rendering ProjectBody with a resolved value — the render pass that
    // hit "Missing getServerSnapshot" (useSyncExternalStore with no 3rd arg),
    // which made React discard and re-render that subtree client-only,
    // reacquiring — and logging as a FiberFailure — a *second* component
    // scope server-side. Neither RTL's `render` nor `renderToString` waits
    // out the Suspense boundary, so only a streaming SSR render reproduces it.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let errors: string[]
    try {
      ;({ errors } = await ssrRender(
        <Providers demoMode={false}>
          <Board demoMode={false} />
        </Providers>,
      ))
    } finally {
      spy.mockRestore()
    }
    const consoleErrors = spy.mock.calls.map((call) => String(call[0]))
    const all = [...errors, ...consoleErrors]
    expect(all.some((m) => m.includes('getServerSnapshot'))).toBe(false)
    expect(all.some((m) => m.includes('Service not found'))).toBe(false)
  })

  it('the draft is the DraftEditor service atom: the panel reads and writes it there', async () => {
    function Probe() {
      const value = useAtomValue(useService(DraftEditor).draft)
      return <output aria-label="service draft">{value}</output>
    }
    renderStrict(
      <Providers demoMode={false}>
        <LayerProvider provide={[makeDraftEditorLayer('t1')]}>
          <Suspense fallback={null}>
            <DraftEditorPanel taskId="t1" />
            <Probe />
          </Suspense>
        </LayerProvider>
      </Providers>,
    )
    fireEvent.change(await screen.findByLabelText('new comment', {}, { timeout: SCOPE_LOAD_TIMEOUT }), { target: { value: 'hello' } })
    await waitFor(() => expect(screen.getByLabelText('service draft').textContent).toBe('hello'))
  })
})

describe('Board — cache-backed mutations (no router.refresh)', () => {
  const alpha = async () => {
    renderStrict(
      <Providers demoMode={false}>
        <Board demoMode={false} />
      </Providers>,
    )
    await screen.findByRole('button', { name: /write spec/i }, { timeout: SCOPE_LOAD_TIMEOUT })
    return screen.getByRole('region', { name: /project: alpha/i })
  }

  it('create shows the task optimistically and rolls it back on the simulated failure', async () => {
    let reply!: (r: unknown) => void
    actions.createTask.mockImplementation(() => new Promise((resolve) => (reply = resolve)))
    const project = await alpha()
    fireEvent.change(within(project).getByLabelText(/new task title/i), { target: { value: 'Doomed' } })
    fireEvent.click(within(project).getByLabelText(/simulate failure/i))
    fireEvent.click(within(project).getByRole('button', { name: /create task/i }))

    expect(await within(project).findByRole('button', { name: /doomed/i })).not.toBeNull()
    expect(actions.createTask).toHaveBeenCalledWith({ projectId: 'p1', title: 'Doomed', simulateFailure: true })
    reply({ ok: false, error: 'Simulated failure: create rejected before commit' })

    await waitFor(() => expect(within(project).queryByRole('button', { name: /doomed/i })).toBeNull())
    expect(within(project).getByRole('alert').textContent).toBe('Simulated failure: create rejected before commit')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('a successful create refetches the board from the server', async () => {
    actions.createTask.mockResolvedValue({ ok: true, data: {} })
    const project = await alpha()
    const reads = actions.readBoard.mock.calls.length
    const saved = [{ ...actions.dto[0]!, tasks: [...actions.dto[0]!.tasks, actions.task('t9', 'p1', 'Saved')] }, actions.dto[1]!]
    actions.readBoard.mockImplementation(async () => saved)
    fireEvent.change(within(project).getByLabelText(/new task title/i), { target: { value: 'Saved' } })
    fireEvent.click(within(project).getByRole('button', { name: /create task/i }))

    await waitFor(() => expect(actions.readBoard.mock.calls.length).toBeGreaterThan(reads))
    expect(await within(project).findByRole('button', { name: /saved/i })).not.toBeNull()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('a move shows the new status optimistically, before the action settles', async () => {
    actions.moveTask.mockImplementation(() => new Promise(() => {}))
    const project = await alpha()
    fireEvent.click(within(project).getByRole('button', { name: /write spec/i }))
    const detail = await screen.findByLabelText(/task detail: write spec/i, {}, { timeout: SCOPE_LOAD_TIMEOUT })
    fireEvent.click(within(detail).getByRole('button', { name: 'done' }))
    await waitFor(() => expect(within(project).getByRole('button', { name: /write spec — done/i })).not.toBeNull())
    expect(actions.moveTask).toHaveBeenCalledWith({ taskId: 't1', status: 'done' })
  })
})
