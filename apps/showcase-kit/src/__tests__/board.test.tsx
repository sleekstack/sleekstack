/**
 * apps/showcase-kit/src/__tests__/board.test.tsx
 *
 * R6/R7/R8: the client board under StrictMode. `next/navigation` is mocked
 * (no App Router context under RTL) and `board.actions.ts`'s Server Actions
 * are mocked, so these are pure component tests of the LayerProvider
 * nesting, scope-log ordering and the "break detail" error boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderToPipeableStream } from 'react-dom/server'
import { PassThrough } from 'node:stream'
import { Suspense, useSyncExternalStore, type ReactNode } from 'react'
import { LayerProvider, useAtomValue, useService } from '@sleekstack/kit/react'
import { renderStrict } from './renderStrict'
import { Board, type BoardProject } from '../client/Board'
import { Providers } from '../../app/providers'
import { scopeLog } from '../client/ScopeLog'
import { DraftEditorPanel } from '../client/TaskDetail'
import { DraftEditor, makeDraftEditorLayer, selectionMemory } from '../client/component-services'

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

const board: readonly BoardProject[] = [
  {
    project: { id: 'p1', name: 'Alpha' },
    tasks: [{ task: { id: 't1', projectId: 'p1', title: 'Write spec', status: 'todo', createdAt: 0 }, comments: [] }],
  },
  {
    project: { id: 'p2', name: 'Beta' },
    tasks: [{ task: { id: 't2', projectId: 'p2', title: 'Ship it', status: 'todo', createdAt: 0 }, comments: [] }],
  },
]

beforeEach(() => {
  scopeLog.reset()
  selectionMemory.clear()
  refresh.mockClear()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const messages = () => scopeLog.list().map((e) => e.message)

describe('Board — R7/R8 nested component scopes', () => {
  it('opening task detail logs 1 acquire; closing (full unmount) logs 1 release, child before project', async () => {
    const { unmount } = renderStrict(
      <Providers demoMode={false}>
        <Board board={board} demoMode={false} />
      </Providers>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /write spec/i }))

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
        <Board board={board} demoMode={false} />
      </Providers>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /write spec/i }))
    await screen.findByLabelText(/task detail: write spec/i)

    fireEvent.click(screen.getByLabelText(/break detail/i))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/DraftEditor acquisition failed for task t1/)
    })

    // The failing subtree's own project stays mounted (create-task form still there)...
    const alphaProject = screen.getByRole('region', { name: /project: alpha/i })
    expect(within(alphaProject).getByRole('button', { name: /create task/i })).not.toBeNull()
    // ...and the sibling project's task list is untouched.
    expect(await screen.findByRole('button', { name: /ship it/i })).not.toBeNull()
  })

  it('the demo toggle triggers a refresh; a new demoMode key releases the old scopes and remounts the open detail', async () => {
    const { rerender } = renderStrict(
      <Providers demoMode={false}>
        <Board board={board} demoMode={false} />
      </Providers>,
    )

    fireEvent.click(await screen.findByRole('button', { name: /write spec/i }))
    await waitFor(() => expect(messages().some((m) => m.startsWith('acquire: DraftEditor (t1)'))).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: /enter demo mode/i }))
    expect(refresh).toHaveBeenCalledTimes(1)

    // Simulates the server round-trip `router.refresh()` triggers: the server
    // re-reads the cookie and passes the new `demoMode` down, changing the
    // app LayerProvider's `key` (providers.tsx) and remounting the tree.
    rerender(
      <Providers demoMode={true}>
        <Board board={board} demoMode={true} />
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
    expect(await screen.findByLabelText(/task detail: write spec/i)).not.toBeNull()
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
          <Board board={board} demoMode={false} />
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
    fireEvent.change(await screen.findByLabelText('new comment'), { target: { value: 'hello' } })
    await waitFor(() => expect(screen.getByLabelText('service draft').textContent).toBe('hello'))
  })
})
