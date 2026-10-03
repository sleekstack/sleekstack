import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Atom } from '@sleekstack/core'
import { LayerProvider, useAtomValue, useQuery } from '@sleekstack/react'
import { Query } from '@sleekstack/query'
import { Effect } from 'effect'
import { STORES_KEY } from '@sleekstack/react/internal'
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
    expect(screen.getByText(/No queries recorded/)).not.toBeNull()
    expect(document.querySelector(`[data-devtools="${DEVTOOLS_MARKER}"]`)).not.toBeNull()
  })

  it('shows graph, live scopes, errors and read-only atoms', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      scopes: [{ at: 0, kind: 'acquire', label: 'app' }],
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

  it('lists atoms of every open provider store, skips a store that throws, and drops unmounted stores', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Not Found', { status: 404 })))
    const draft = Atom.make('hello')
    const Reader = () => <span>{useAtomValue(draft)}</span>
    const provider = render(<LayerProvider provide={[]}><Reader /></LayerProvider>)
    await screen.findByText('hello')
    const set = (globalThis as Record<string, unknown>)[STORES_KEY] as Set<unknown>
    const broken = { inspect: () => { throw new Error('disposed') } }
    set.add(broken)
    render(<SleekStackDevtools intervalMs={20} />)
    expect(await screen.findByText(`store 1 · ${draft.label}:`, { exact: false })).not.toBeNull()
    set.delete(broken)
    provider.unmount()
    expect(await screen.findByText(/No atoms registered/)).not.toBeNull()
  })

  it('renders a prop atom that is also in a registered store once, under its prop label', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Not Found', { status: 404 })))
    const count = Atom.make(42)
    render(<LayerProvider provide={[]}><SleekStackDevtools atoms={{ count }} intervalMs={20} /></LayerProvider>)
    expect(await screen.findByText('42')).not.toBeNull()
    await new Promise((r) => setTimeout(r, 60)) // let the registry poll pick up the built atom
    expect(screen.getAllByText('42')).toHaveLength(1)
    expect(screen.queryByText(count.label, { exact: false })).toBeNull()
  })

  it('hides a prop atom only in the panel provider store; the same atom in a sibling provider stays listed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Not Found', { status: 404 })))
    const count = Atom.make(5)
    const Bump = () => { const v = useAtomValue(count); return <span>sibling {v}</span> }
    render(
      <>
        <LayerProvider provide={[]}><Bump /></LayerProvider>
        <LayerProvider provide={[]}><SleekStackDevtools atoms={{ count }} intervalMs={20} /></LayerProvider>
      </>,
    )
    expect(await screen.findByText('sibling 5')).not.toBeNull()
    expect(await screen.findByText(`${count.label}:`, { exact: false })).not.toBeNull()
    await new Promise((r) => setTimeout(r, 60))
    expect(screen.getAllByText(`${count.label}:`, { exact: false })).toHaveLength(1) // sibling store's instance only
    expect(screen.getByText('count:', { exact: false })).not.toBeNull() // prop row, once
  })

  it('shows service acquire/release with scope and fiber, and links an error to its closed scope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      disabled: false,
      scopes: [{ at: 0, kind: 'acquire', label: 'Db', scope: 'request#2', fiber: '#7' }],
      errors: [{ at: 1, kind: 'error', label: 'defect', detail: 'boom', scope: 'request#2' }],
      live: { app: true, scopes: [] },
    })))
    render(<SleekStackDevtools />)
    expect(await screen.findByText('acquire Db in request#2 (#7)')).not.toBeNull()
    expect(screen.getByText('scope: request#2 (closed)')).not.toBeNull()
  })

  it('renders the disabled state, distinct from empty data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ disabled: true, scopes: [], errors: [], live: { app: false, scopes: [] } })))
    render(<SleekStackDevtools />)
    expect(await screen.findByText(/tracing is disabled/)).not.toBeNull()
    expect(screen.queryByText(/No errors recorded/)).toBeNull()
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

  it('a body whose graph roots are malformed shows the no-graph state, not a crash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ scopes: [], errors: [], live: { app: true, scopes: [] }, graph: { roots: [{}] } })))
    render(<SleekStackDevtools />)
    expect(await screen.findByText(/No graph report supplied/)).not.toBeNull()
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
    expect(graphsOf({ graphs: [], roots: [{ graph: g }] })).toHaveLength(1)
    expect(graphsOf({ roots: [{ graph: g }, { graph: {} }] })).toHaveLength(1)
    expect(graphsOf(null)).toEqual([])
  })

  it('a body with a null error entry is off, not a crash', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ scopes: [], errors: [null], live: { app: true, scopes: [] } })))
    render(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
  })

  it('a body with an object-valued error detail or non-boolean live.app is off', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ scopes: [], errors: [{ at: 1, kind: 'error', label: 'x', detail: {} }], live: { app: true, scopes: [] } })))
    const first = render(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
    first.unmount()
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ scopes: [], errors: [], live: { scopes: [] } })))
    render(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
  })

  it('Queries tab lists query entries with state and updatedAt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Not Found', { status: 404 })))
    const todo = Query.make({ key: (id: string) => ['todo', id], fetch: (id) => Effect.succeed(`title ${id}`) })
    const Todo = () => <span>{useQuery(todo('t1')).data}</span>
    render(<><LayerProvider provide={[]}><Todo /></LayerProvider><SleekStackDevtools intervalMs={20} /></>)
    expect(await screen.findByText('title t1')).not.toBeNull()
    const entry = await screen.findByText(/Success, 1 observers, updated \d{4}-/)
    expect(entry.textContent).toContain('["todo","t1"]')
    expect(screen.getByText('added ["todo","t1"]')).not.toBeNull()
  })
})
