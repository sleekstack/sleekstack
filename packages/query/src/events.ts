/**
 * packages/query/src/events.ts
 *
 * Client-side dev event buffer for query entries (the runtime's dev buffer is server-only). The query
 * lifecycle records each event as it happens (`emit`); `snapshot` lists live entries. Each kind has its
 * own ring, so focus/interval refetch chatter (`fetching`) cannot evict `added`/`success`/`failure`/`removed`.
 * Nothing records when `NODE_ENV` is `production` or `process` is absent.
 */

import { Result, type AtomStore } from '@sleekstack/core'
import { entries, type QueryEntry } from './query'

/** Event kinds; each has its own capped ring. */
export type QueryEventKind = 'added' | 'fetching' | 'success' | 'failure' | 'removed'

/** One query entry change. */
export interface QueryEvent {
  /** Time (ms) the change was sampled. */
  readonly at: number
  readonly kind: QueryEventKind
  /** Canonical key. */
  readonly key: string
  /** The event kind for a recorded event; the Result tag plus `waiting` (e.g. `Success (waiting)`) for a `snapshot` row. */
  readonly state: string
  readonly observers: number
  readonly updatedAt: number | undefined
  /** Idle time (ms) before an unobserved entry is removed; `Infinity` when kept. */
  readonly gcTime: number
}

/** Events kept per kind. */
export const CAP_PER_KIND = 50

declare const process: { readonly env: { readonly NODE_ENV?: string } }
// direct `process.env.NODE_ENV` so bundlers fold it; no `process` at all (unbundled browser) counts as production
const enabled = (): boolean => typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'

// `seq` keeps recording order across rings (several events can share one `at`)
const rings = new Map<QueryEventKind, { readonly seq: number; readonly event: QueryEvent }[]>()
let seq = 0

/** Appends `event` to its kind's ring, dropping that kind's oldest past {@link CAP_PER_KIND}. No-op in production. */
export const record = (event: QueryEvent): void => {
  if (!enabled()) return
  const ring = rings.get(event.kind) ?? []
  ring.push({ seq: seq++, event })
  if (ring.length > CAP_PER_KIND) ring.shift()
  rings.set(event.kind, ring)
}

/** All buffered events, in recording order. */
export const events = (): readonly QueryEvent[] => [...rings.values()].flat().sort((a, b) => a.seq - b.seq).map((r) => r.event)

/** Empties the buffer (tests). */
export const clear = (): void => rings.clear()

/** @internal Records `kind` for `entry` now; called by the query lifecycle in `query.ts`. No-op in production. */
export const emit = (kind: QueryEventKind, entry: QueryEntry): void => {
  if (!enabled()) return
  record({ at: Date.now(), kind, key: entry.key, state: kind, observers: entry.observers, updatedAt: entry.updatedAt, gcTime: gcTimeOf(entry) })
}

const gcTimeOf = (e: QueryEntry): number => (e.atom.keepAlive ? Infinity : (e.atom.idleTTL ?? Infinity))

/**
 * The current entries of `store`'s query registry (state, observers, updatedAt, gc timer). Reads values via
 * `store.inspect()`, so it never builds or refetches a node, and records nothing.
 *
 * @param store - The atom store.
 * @returns One row per live, built entry.
 */
export const snapshot = (store: AtomStore): readonly QueryEvent[] => {
  const values = new Map(store.inspect().map((a) => [a.atom, a.value] as const))
  // only touch the registry once a query was read in this store (entries() builds it otherwise)
  if (![...values.keys()].some((a) => typeof a === 'object' && a !== null && Symbol.for('@sleekstack/query/Query') in a)) return []
  const at = Date.now()
  return [...entries(store).values()].flatMap((e) => {
    const r = values.get(e.atom) as Result.Result<unknown, unknown> | undefined
    if (!r) return []
    const kind: QueryEventKind = r.waiting ? 'fetching' : Result.isSuccess(r) ? 'success' : Result.isFailure(r) ? 'failure' : 'added'
    return [{ at, kind, key: e.key, state: `${r._tag}${r.waiting ? ' (waiting)' : ''}`, observers: e.observers, updatedAt: e.updatedAt, gcTime: gcTimeOf(e) }]
  })
}
