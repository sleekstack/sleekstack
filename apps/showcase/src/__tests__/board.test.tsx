/**
 * apps/showcase/src/__tests__/board.test.tsx
 *
 * R6/R7/R8: the client board under StrictMode. `next/navigation` is mocked
 * (no App Router context under RTL) and `board.actions.ts`'s Server Actions
 * are mocked, so these are pure component tests of the LayerProvider
 * nesting, scope-log ordering and the "break detail" error boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderStrict } from './renderStrict'
import { Board, type BoardProject } from '../client/Board'
import { Providers } from '../../app/providers'
import { scopeLog } from '../client/ScopeLog'

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

  it('the demo toggle triggers a refresh; a new demoMode key remounts and releases the old scopes', async () => {
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
    })
  })
})
