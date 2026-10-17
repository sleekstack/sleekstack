/** @jsxImportSource @sleekstack/ui */
import { Atom, makeAtomStore, type AtomStore } from '@sleekstack/core'
import { QueryClientLive, QueryClientTag } from '@sleekstack/query'
import { flush, render, type Rendered } from '@sleekstack/testing'
import { mount, Provider, useAtomValue, type Mounted } from '@sleekstack/ui'
import { screen } from '@testing-library/dom'
import { Layer } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEVTOOLS_MARKER, graphsOf, SleekStackDevtools, uiTrace, type UiTrace } from '../index'

// This package runs vitest without globals, so `@sleekstack/testing` cannot clean up itself.
let handles: Array<Mounted | Rendered> = []
const track = <H extends Mounted | Rendered>(h: H): H => (handles.push(h), h)
afterEach(async () => {
  for (const h of handles) await h.dispose()
  handles = []
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type App = Parameters<typeof render>[0]
const show = async (app: App, options: { store?: AtomStore; layer?: Layer.Layer<any, any, never> } = {}) =>
  track(await render(app, { layer: (options.layer ?? Layer.empty) as never, store: options.store }))
/** Mounts `app` on `store`, observed by `trace` (how a ui app exposes its stores to the panel). */
const traced = async (app: App, trace: UiTrace, store: AtomStore) =>
  track(
    await mount(app, {
      layer: Layer.empty as never,
      container: document.body.appendChild(document.createElement('div')),
      store,
      observe: trace.observer(store),
    }),
  )
const off = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('Not Found', { status: 404 })),
  )
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('SleekStackDevtools', () => {
  it('renders an empty state when the handler is off', async () => {
    off()
    await show(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
    expect(screen.getByText(/No atoms registered/)).not.toBeNull()
    expect(screen.getByText(/No queries recorded/)).not.toBeNull()
    expect(document.querySelector(`[data-devtools="${DEVTOOLS_MARKER}"]`)).not.toBeNull()
  })

  it('shows graph, live scopes, errors and read-only atoms', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          scopes: [{ at: 0, kind: 'acquire', label: 'app' }],
          errors: [{ at: 1, kind: 'error', label: 'defect', detail: 'boom' }],
          live: { app: true, scopes: ['request#3'] },
          graph: {
            roots: [
              {
                root: 'app',
                graph: {
                  nodes: [{ id: 'a', name: 'Store', lifetime: 'app' }],
                  edges: [{ from: 'a', to: 'b', tag: 'Db' }],
                },
              },
            ],
          },
        }),
      ),
    )
    const count = Atom.make(7)
    await show(<SleekStackDevtools atoms={{ count }} />)
    expect(await screen.findByText(/1 nodes, 1 edges/)).not.toBeNull()
    expect(screen.getByText('a → b (Db)')).not.toBeNull()
    expect(screen.getByText('request#3')).not.toBeNull()
    expect(screen.getByText('boom')).not.toBeNull()
    expect(await screen.findByText('7')).not.toBeNull()
  })

  it('lists atoms of every open traced store, skips a store that throws, and drops unmounted stores', async () => {
    off()
    const draft = Atom.make('hello')
    const Reader = function* () {
      return <span>{yield* useAtomValue(draft)}</span>
    }
    const trace = uiTrace()
    const app = await traced(<Reader />, trace, makeAtomStore())
    await screen.findByText('hello')
    const broken = {
      inspect: () => {
        throw new Error('disposed')
      },
    } as unknown as AtomStore
    const brokenObserver = trace.observer(broken)
    brokenObserver({ type: 'create', mount: -1, instance: 1, path: 'broken' } as never)
    await show(<SleekStackDevtools trace={trace} intervalMs={20} />)
    expect(await screen.findByText(`store 1 · ${draft.label}:`, { exact: false })).not.toBeNull()
    brokenObserver({ type: 'dispose', mount: -1, instance: 1 })
    await app.dispose()
    expect(await screen.findByText(/No atoms registered/)).not.toBeNull()
  })

  it('renders a prop atom that is also in a traced store once, under its prop label', async () => {
    off()
    const count = Atom.make(42)
    const trace = uiTrace()
    const store = makeAtomStore()
    await traced(<p>app</p>, trace, store)
    await show(<SleekStackDevtools atoms={{ count }} trace={trace} intervalMs={20} />, { store })
    expect(await screen.findByText('42')).not.toBeNull()
    await wait(60) // let the store poll pick up the built atom
    expect(screen.getAllByText('42')).toHaveLength(1)
    expect(screen.queryByText(count.label, { exact: false })).toBeNull()
  })

  it("hides a prop atom only in the panel's own store; the same atom in a sibling store stays listed", async () => {
    off()
    const count = Atom.make(5)
    const Bump = function* () {
      const v = yield* useAtomValue(count)
      return <span>sibling {v}</span>
    }
    const trace = uiTrace()
    const own = makeAtomStore()
    await traced(<Bump />, trace, makeAtomStore())
    await traced(<p>panel app</p>, trace, own)
    await show(<SleekStackDevtools atoms={{ count }} trace={trace} intervalMs={20} />, { store: own })
    expect(await screen.findByText('sibling 5')).not.toBeNull()
    expect(await screen.findByText(`${count.label}:`, { exact: false })).not.toBeNull()
    await wait(60)
    expect(screen.getAllByText(`${count.label}:`, { exact: false })).toHaveLength(1) // sibling store's instance only
    expect(screen.getByText('count:', { exact: false })).not.toBeNull() // prop row, once
  })

  it('shows service acquire/release with scope and fiber, and links an error to its closed scope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          disabled: false,
          scopes: [{ at: 0, kind: 'acquire', label: 'Db', scope: 'request#2', fiber: '#7' }],
          errors: [{ at: 1, kind: 'error', label: 'defect', detail: 'boom', scope: 'request#2' }],
          live: { app: true, scopes: [] },
        }),
      ),
    )
    await show(<SleekStackDevtools />)
    expect(await screen.findByText('acquire Db in request#2 (#7)')).not.toBeNull()
    expect(screen.getByText('scope: request#2 (closed)')).not.toBeNull()
  })

  it('renders the disabled state, distinct from empty data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ disabled: true, scopes: [], errors: [], live: { app: false, scopes: [] } })),
    )
    await show(<SleekStackDevtools />)
    expect(await screen.findByText(/tracing is disabled/)).not.toBeNull()
    expect(screen.queryByText(/No errors recorded/)).toBeNull()
  })

  it('keeps at most one request in flight while the endpoint is slow, and aborts on unmount', async () => {
    let calls = 0
    let signal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        calls++
        signal = init?.signal ?? undefined
        return new Promise<Response>(() => {})
      }),
    )
    const panel = await show(<SleekStackDevtools intervalMs={5} />)
    await wait(60)
    expect(calls).toBe(1)
    await panel.dispose()
    expect(signal?.aborted).toBe(true)
  })

  it('treats a successful but malformed body as off', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({})),
    )
    await show(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
  })

  it('a body whose graph roots are malformed shows the no-graph state, not a crash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ scopes: [], errors: [], live: { app: true, scopes: [] }, graph: { roots: [{}] } }),
      ),
    )
    await show(<SleekStackDevtools />)
    expect(await screen.findByText(/No graph report supplied/)).not.toBeNull()
  })

  it('a hung request times out and polling continues', async () => {
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((_u: string, init?: RequestInit) => {
        calls++
        return new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        )
      }),
    )
    vi.useFakeTimers()
    try {
      await show(<SleekStackDevtools intervalMs={10} />)
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ scopes: [], errors: [null], live: { app: true, scopes: [] } })),
    )
    await show(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
  })

  it('a body with an object-valued error detail or non-boolean live.app is off', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          scopes: [],
          errors: [{ at: 1, kind: 'error', label: 'x', detail: {} }],
          live: { app: true, scopes: [] },
        }),
      ),
    )
    const first = await show(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
    await first.dispose()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ scopes: [], errors: [], live: { scopes: [] } })),
    )
    await show(<SleekStackDevtools />)
    expect(await screen.findByText(/Devtools are off/)).not.toBeNull()
  })

  it('Queries tab lists the QueryCache entries and events of the scope client', async () => {
    off()
    let client: typeof QueryClientTag.Service | undefined
    const Probe = function* () {
      client = yield* QueryClientTag
      return <></>
    }
    await show(
      <>
        <Probe />
        <SleekStackDevtools intervalMs={20} />
      </>,
      { layer: QueryClientLive() },
    )
    expect(await screen.findByText(/No queries recorded/)).not.toBeNull()
    await client!.fetchQuery({ queryKey: ['todo', 't1'], queryFn: async () => 'title t1' })
    const entry = await screen.findByText(/success, 0 observers, updated \d{4}-/)
    expect(entry.textContent).toContain('["todo","t1"]')
    for (const e of ['added', 'fetching', 'success']) expect(screen.getByText(`${e} ["todo","t1"]`)).not.toBeNull()
    await client!
      .fetchQuery({
        queryKey: ['bad'],
        queryFn: async () => {
          throw new Error('nope')
        },
      })
      .catch(() => {})
    expect(await screen.findByText('failure ["bad"]')).not.toBeNull()
    client!.removeQueries({ queryKey: ['todo', 't1'] })
    expect(await screen.findByText('removed ["todo","t1"]')).not.toBeNull()
  })

  it('Queries tab shows the empty state without a client in scope and nothing in production', async () => {
    off()
    const first = await show(<SleekStackDevtools />)
    expect(await screen.findByText(/No queries recorded/)).not.toBeNull()
    await first.dispose()
    vi.stubEnv('NODE_ENV', 'production')
    try {
      await show(<SleekStackDevtools />)
      await flush()
      expect(document.querySelector('[data-devtools-queries]')).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('Queries tab rethrows a client layer failure instead of showing the empty state', async () => {
    off()
    const failing = QueryClientLive(() => {
      throw new Error('config broke')
    })
    const errors: unknown[] = []
    await render(
      <Provider layer={failing}>
        <SleekStackDevtools />
      </Provider>,
      { layer: Layer.empty, onError: (cause) => errors.push(cause) },
    ).then(track, (e: unknown) => errors.push(e))
    await vi.waitFor(() => expect(String(errors)).toMatch(/config broke/))
    expect(screen.queryByText(/No queries recorded/)).toBeNull()
  })
})
