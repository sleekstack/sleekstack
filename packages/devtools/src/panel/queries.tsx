/**
 * packages/devtools/src/panel/queries.tsx
 *
 * Queries tab: lists the scope's TanStack `QueryCache` entries (via `QueryClientTag`) and its recent
 * cache events, live from `QueryCache.subscribe`. Renders nothing in production; the empty state when
 * no client is in scope.
 */
import { Component, Suspense, useEffect, useState, type ReactNode } from 'react'
import { QueryClientTag } from '@sleekstack/query'
import { useService } from '@sleekstack/react'

/** Present in the Queries tab; production bundle tests assert it is absent from client chunks. */
export const QUERY_DEVTOOLS_MARKER = 'sleekstack-devtools-queries-4b7e'

type Client = typeof QueryClientTag.Service
type Row = { readonly key: string; readonly state: string; readonly observers: number; readonly updatedAt: number; readonly gcTime: number }

declare const process: { readonly env: { readonly NODE_ENV?: string } }
// direct `process.env.NODE_ENV` so bundlers fold it; no `process` at all (unbundled browser) counts as production
const enabled = (): boolean => typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'

const SHOWN = 20
const rowsOf = (client: Client): Row[] =>
  client.getQueryCache().getAll().map((q) => ({
    key: q.queryHash,
    state: q.state.status,
    observers: q.getObserversCount(),
    updatedAt: q.state.dataUpdatedAt,
    gcTime: q.gcTime,
  }))

const time = (ms: number) => (ms === 0 ? 'never' : new Date(ms).toISOString())
const gc = (ms: number) => (Number.isFinite(ms) ? `${ms}ms` : 'kept')
const empty = <p>No queries recorded.</p>

function Entries({ client }: { readonly client: Client }) {
  const [rows, setRows] = useState(() => rowsOf(client))
  const [events, setEvents] = useState<readonly string[]>([])
  useEffect(() => {
    setRows(rowsOf(client))
    return client.getQueryCache().subscribe((e) => {
      setRows(rowsOf(client))
      setEvents((prev) => [...prev, `${e.type} ${e.query.queryHash}`].slice(-SHOWN))
    })
  }, [client])
  if (rows.length === 0 && events.length === 0) return empty
  return (
    <>
      <ul aria-label="query entries">
        {rows.map((r) => (
          <li key={r.key}><code>{r.key}</code>: {r.state}, {r.observers} observers, updated {time(r.updatedAt)}, gc {gc(r.gcTime)}</li>
        ))}
      </ul>
      <ul aria-label="query events">{events.map((e, i) => <li key={i}>{e}</li>)}</ul>
    </>
  )
}

const ScopeEntries = () => <Entries client={useService(QueryClientTag)} />

/** No `LayerProvider` or no `QueryClientTag` in scope: `useService` throws and the empty state shows. */
class NoClient extends Component<{ readonly children: ReactNode }, { readonly failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError = () => ({ failed: true })
  override render = () => (this.state.failed ? empty : this.props.children)
}

/** Query entries (key, status, observers, updatedAt, gc time) and the last 20 cache events. `intervalMs` is unused: updates are pushed. */
export function QueriesSection(_: { readonly intervalMs?: number }) {
  if (!enabled()) return null
  return (
    <section aria-label="queries" data-devtools-queries={QUERY_DEVTOOLS_MARKER}>
      <h3>Queries</h3>
      <NoClient><Suspense fallback={empty}><ScopeEntries /></Suspense></NoClient>
    </section>
  )
}
