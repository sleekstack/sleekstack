/**
 * packages/devtools/src/panel/queries.tsx
 *
 * Queries tab: samples every open store's query registry into `@sleekstack/query`'s client-side event
 * buffer on each poll, then lists the live entries and the recent events.
 */
import { useEffect, useState } from 'react'
import { QueryEvents } from '@sleekstack/query'
import type { AtomStore } from '@sleekstack/core'
import { atomStores } from '@sleekstack/react/internal'

/** Present in the Queries tab; production bundle tests assert it is absent from client chunks. */
export const QUERY_DEVTOOLS_MARKER = 'sleekstack-devtools-queries-4b7e'

type Snapshot = { readonly rows: readonly QueryEvents.QueryEvent[]; readonly events: readonly QueryEvents.QueryEvent[] }

// Stores seen on the previous poll: one that left the registry (provider unmounted) gets a final sample,
// which records `removed` for its entries.
let previous: readonly AtomStore[] = []

const read = (): Snapshot => {
  const stores = atomStores()
  for (const gone of previous.filter((s) => !stores.includes(s))) {
    try { QueryEvents.sample(gone) } catch { /* disposed mid-poll */ }
  }
  previous = stores
  const rows = stores.flatMap((store) => {
    try {
      return QueryEvents.sample(store)
    } catch {
      return []
    }
  })
  return { rows, events: QueryEvents.events() }
}

const time = (ms: number | undefined) => (ms === undefined ? 'never' : new Date(ms).toISOString())
const gc = (ms: number) => (Number.isFinite(ms) ? `${ms}ms` : 'kept')

/** Live query entries (key, state, observers, updatedAt, gc timer) and the last 20 buffered events. */
export function QueriesSection({ intervalMs }: { readonly intervalMs: number }) {
  const [{ rows, events }, setSnapshot] = useState<Snapshot>(read)
  useEffect(() => {
    const timer = setInterval(() => setSnapshot(read()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return (
    <section aria-label="queries" data-devtools-queries={QUERY_DEVTOOLS_MARKER}>
      <h3>Queries</h3>
      {rows.length === 0 && events.length === 0 ? <p>No queries recorded.</p> : (
        <>
          <ul aria-label="query entries">
            {rows.map((r, i) => (
              <li key={`${i}:${r.key}`}><code>{r.key}</code>: {r.state}, {r.observers} observers, updated {time(r.updatedAt)}, gc {gc(r.gcTime)}</li>
            ))}
          </ul>
          <ul aria-label="query events">
            {events.slice(-20).map((e, i) => <li key={`${e.at}-${i}`}>{`${e.kind} ${e.key}`}</li>)}
          </ul>
        </>
      )}
    </section>
  )
}
