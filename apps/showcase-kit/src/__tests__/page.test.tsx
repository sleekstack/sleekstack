/**
 * apps/showcase-kit/src/__tests__/page.test.tsx
 *
 * fn-16 R3: a failed board prefetch renders the client-fetch fallback (a placeholder, then the client fetch)
 * instead of crashing the page. The prefetched path is covered by e2e/smoke.spec.ts against `next start`.
 */
import { expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
const actions = vi.hoisted(() => ({
  readBoard: vi.fn(async () => [{ project: { id: 'p1', name: 'Alpha' }, tasks: [] }]),
  createTask: vi.fn(),
  moveTask: vi.fn(),
  addComment: vi.fn(),
}))
vi.mock('../server/board.actions', () => actions)
vi.mock('@sleekstack/kit/next', async (orig) => ({
  ...(await orig<object>()),
  prefetch: vi.fn(async () => {
    throw new Error('prefetch down')
  }),
}))

it('a failed prefetch renders the placeholder, then the client fetches the board', async () => {
  const { default: HomePage } = await import('../../app/page')
  const page = await HomePage()
  expect(renderToString(page)).toContain('Loading board…')
  render(page)
  expect(await screen.findByRole('region', { name: 'project: Alpha' }, { timeout: 10_000 })).toBeTruthy()
  expect(actions.readBoard).toHaveBeenCalled()
}, 30_000) // the cold import and first render of the page can be slow on a loaded CI runner
