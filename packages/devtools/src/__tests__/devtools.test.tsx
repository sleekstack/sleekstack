import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Atom } from '@sleekstack/core'
import { LayerProvider } from '@sleekstack/react'
import { SleekStackDevtools, DEVTOOLS_MARKER, graphsOf } from '../index'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('SleekStackDevtools', () => {
  it('renders an empty state when the handler is off', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Not Found', { status: 404 })))
    render(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
    expect(screen.getByText(/No atoms registered/)).not.toBeNull()
    expect(document.querySelector(`[data-devtools="${DEVTOOLS_MARKER}"]`)).not.toBeNull()
  })

  it('shows graph, live scopes, errors and read-only atoms', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      scopes: [],
      errors: [{ at: 1, kind: 'error', label: 'defect', detail: 'boom' }],
      live: { app: true, scopes: ['request#3'] },
      graph: { roots: [{ root: 'app', graph: { nodes: [{ id: 'a', name: 'Store', lifetime: 'app' }], edges: [{ from: 'a', to: 'b', tag: 'Db' }] } }] },
    })))
    const count = Atom.make(7)
    render(
      <LayerProvider provide={[]}>
        <SleekStackDevtools atoms={{ count }} />
      </LayerProvider>,
    )
    expect(await screen.findByText(/1 nodes, 1 edges/)).not.toBeNull()
    expect(screen.getByText('a → b (Db)')).not.toBeNull()
    expect(screen.getByText('request#3')).not.toBeNull()
    expect(screen.getByText('boom')).not.toBeNull()
    expect(await screen.findByText('7')).not.toBeNull()
  })

  it('keeps at most one request in flight while the endpoint is slow, and aborts on unmount', async () => {
    let calls = 0
    let signal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      calls++
      signal = init?.signal ?? undefined
      return new Promise<Response>(() => {})
    }))
    const { unmount } = render(<SleekStackDevtools intervalMs={5} />)
    await new Promise((r) => setTimeout(r, 60))
    expect(calls).toBe(1)
    unmount()
    expect(signal?.aborted).toBe(true)
  })

  it('treats a successful but malformed body as off', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({})))
    render(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
  })

  it('treats a body whose graph roots are malformed as off', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ scopes: [], errors: [], live: { app: true, scopes: [] }, graph: { roots: [{}] } })))
    render(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
  })

  it('a hung request times out and polling continues', async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      vi.stubGlobal('fetch', vi.fn((_u: string, init?: RequestInit) => {
        calls++
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
      }))
      render(<SleekStackDevtools intervalMs={10} />)
      await vi.advanceTimersByTimeAsync(5000 + 20)
      expect(calls).toBeGreaterThanOrEqual(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reads the canonical analyzer Report (runtimes / graphs) as well as the CLI envelope', () => {
    const g = { root: 'r', nodes: [{ id: 'a', name: 'A', lifetime: 'app' }], edges: [] }
    expect(graphsOf({ runtimes: [{ graph: g }], graphs: [], errors: [], extraction: [] })).toHaveLength(1)
    expect(graphsOf({ graphs: [g] })).toHaveLength(1)
    expect(graphsOf({ roots: [{ graph: g }, { graph: {} }] })).toHaveLength(1)
    expect(graphsOf(null)).toEqual([])
  })

  it('a body with a null error entry is off, not a crash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ scopes: [], errors: [null], live: { app: true, scopes: [] } })))
    render(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
  })
})
