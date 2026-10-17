/** @jsxImportSource @sleekstack/ui */
/**
 * packages/devtools/src/panel/queries.tsx
 *
 * Queries tab: lists the scope's TanStack `QueryCache` entries (via `QueryClientTag`) and its recent
 * cache events, live from `QueryCache.subscribe`. Renders nothing in production; the empty state when
 * no client is in scope.
 */
import { QueryClientTag } from '@sleekstack/query'
import { useEffect, useLocal } from '@sleekstack/ui'
import { Effect, Option } from 'effect'

/** Present in the Queries tab; production bundle tests assert it is absent from client chunks. */
export const QUERY_DEVTOOLS_MARKER = 'sleekstack-devtools-queries-4b7e'

type Client = typeof QueryClientTag.Service

declare const process: { readonly env: { readonly NODE_ENV?: string } }
// direct `process.env.NODE_ENV` so bundlers fold it; no `process` at all (unbundled browser) counts as production
const enabled = (): boolean => typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'

const SHOWN = 20
/** TanStack `updated` actions in the panel's lifecycle vocabulary; observer bookkeeping is not listed. */
const LIFECYCLE: Partial<Record<string, string>> = { fetch: 'fetching', success: 'success', error: 'failure' }
const rowsOf = (client: Client) =>
  client
    .getQueryCache()
    .getAll()
    .map((q) => ({
      key: q.queryHash,
      state: q.state.status,
      observers: q.getObserversCount(),
      updatedAt: q.state.dataUpdatedAt,
      gcTime: q.gcTime,
    }))

const time = (ms: number) => (ms === 0 ? 'never' : new Date(ms).toISOString())
const gc = (ms: number) => (Number.isFinite(ms) ? `${ms}ms` : 'kept')
const Empty = () => <p>No queries recorded.</p>

const Entries = function* ({ client }: { readonly client: Client }) {
  // Every cache event re-runs the entries (a new array), which re-reads the cache.
  const [events, setEvents] = yield* useLocal<readonly string[]>([])
  yield* useEffect(
    () =>
      client.getQueryCache().subscribe((e) => {
        const kind =
          e.type === 'updated'
            ? LIFECYCLE[e.action.type]
            : e.type === 'added' || e.type === 'removed'
              ? e.type
              : undefined
        setEvents((prev) => (kind ? [...prev, `${kind} ${e.query.queryHash}`].slice(-SHOWN) : [...prev]))
      }),
    [client],
  )
  const rows = rowsOf(client)
  if (rows.length === 0 && events.length === 0) return <Empty />
  return (
    <>
      <ul aria-label="query entries">
        {rows.map((r) => (
          <li key={r.key}>
            <code>{r.key}</code>: {r.state}, {r.observers} observers, updated {time(r.updatedAt)}, gc {gc(r.gcTime)}
          </li>
        ))}
      </ul>
      <ul aria-label="query events">
        {events.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
    </>
  )
}

/** Query entries (key, status, observers, updatedAt, gc time) and the last 20 cache events; updates are pushed. */
export const QueriesSection = function* () {
  if (!enabled()) return <></>
  // No client in scope is the empty state; a failing client layer fails where it is provided, never here.
  const client = yield* Effect.serviceOption(QueryClientTag)
  return (
    <section aria-label="queries" data-devtools-queries={QUERY_DEVTOOLS_MARKER}>
      <h3>Queries</h3>
      {Option.isSome(client) ? <Entries client={client.value} /> : <Empty />}
    </section>
  )
}
