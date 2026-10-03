/**
 * packages/query/src/events.ts
 *
 * Client-side dev event buffer for query entries (the runtime's dev buffer is server-only). `sample`
 * diffs a store's registry against what it last saw and records one event per change. Each kind has its
 * own ring, so focus/interval refetch chatter (`fetching`) cannot evict `added`/`success`/`failure`/`removed`.
 * Nothing records when `NODE_ENV` is `production` or `process` is absent.
 */

import { Result, type AtomStore } from '@sleekstack/core'
import { entries } from './query'

/** Event kinds; each has its own capped ring. */
export type QueryEventKind = 'added' | 'fetching' | 'success' | 'failure' | 'initial' | 'removed'

/** One query entry change. */
export interface QueryEvent {
  /** Time (ms) the change was sampled. */
  readonly at: number
  readonly kind: QueryEventKind
  /** Canonical key. */
  readonly key: string
  /** Result tag plus `waiting` (e.g. `Success (waiting)`); `removed` after removal. */
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

const rings = new Map<QueryEventKind, QueryEvent[]>()
const seen = new WeakMap<AtomStore, Map<string, QueryEvent>>()

/** Appends `event` to its kind's ring, dropping that kind's oldest past {@link CAP_PER_KIND}. No-op in production. */
export const record = (event: QueryEvent): void => {
  if (!enabled()) return
  const ring = rings.get(event.kind) ?? []
  ring.push(event)
  if (ring.length > CAP_PER_KIND) ring.shift()
  rings.set(event.kind, ring)
}

/** All buffered events, oldest first. */
export const events = (): readonly QueryEvent[] => [...rings.values()].flat().sort((a, b) => a.at - b.at)

/** Empties the buffer (tests). */
export const clear = (): void => rings.clear()

const kindOf = (r: Result.Result<unknown, unknown>): QueryEventKind =>
  r.waiting ? 'fetching' : Result.isSuccess(r) ? 'success' : Result.isFailure(r) ? 'failure' : 'initial'

/**
 * Records the changes in `store`'s query registry since the last sample (state, observers, updatedAt) and
 * returns its current entries. Reads values via `store.inspect()`, so sampling never builds or refetches a node.
 *
 * @param store - The atom store.
 * @returns One event-shaped row per live entry.
 */
export const sample = (store: AtomStore): readonly QueryEvent[] => {
  const values = new Map(store.inspect().map((a) => [a.atom, a.value] as const))
  const previous = seen.get(store) ?? new Map<string, QueryEvent>()
  const current = new Map<string, QueryEvent>()
  const at = Date.now()
  // only touch the registry once a query was read in this store (entries() builds it otherwise)
  if ([...values.keys()].some((a) => typeof a === 'object' && a !== null && Symbol.for('@sleekstack/query/Query') in a)) {
    for (const e of entries(store).values()) {
      const r = values.get(e.atom) as Result.Result<unknown, unknown> | undefined
      if (!r) continue
      const kind = kindOf(r)
      const row: QueryEvent = {
        at, kind, key: e.key, state: `${r._tag}${r.waiting ? ' (waiting)' : ''}`, observers: e.observers, updatedAt: e.updatedAt,
        gcTime: e.atom.keepAlive ? Infinity : (e.atom.idleTTL ?? Infinity),
      }
      current.set(e.id, row)
      const old = previous.get(e.id)
      if (!old) record({ ...row, kind: 'added' })
      else if (old.state !== row.state || old.observers !== row.observers || old.updatedAt !== row.updatedAt) record(row)
    }
  }
  for (const [id, old] of previous) if (!current.has(id)) record({ ...old, at, kind: 'removed', state: 'removed', observers: 0 })
  seen.set(store, current)
  return [...current.values()]
}
