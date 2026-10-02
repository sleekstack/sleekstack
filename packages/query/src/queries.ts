/**
 * packages/query/src/queries.ts
 *
 * `Queries`: the `QueryClient`-equivalent service over one store's query registry. Bulk operations
 * take a query atom or a filter (key prefix over the key tuple and/or a predicate over the entry).
 */

import { Result, type AtomStore } from '@sleekstack/core'
import { Context, Option } from 'effect'
import { canonicalKey } from './key'
import { entries, trigger, TypeId, withOverride, type QueryAtom, type QueryEntry } from './query'

/** Selects registry entries: every given condition must hold; an empty filter matches all. */
export interface QueryFilter {
  /** Leading key-tuple elements, compared by canonical form. */
  readonly prefix?: ReadonlyArray<unknown>
  /** Arbitrary test over the entry. */
  readonly predicate?: (entry: QueryEntry) => boolean
}

/** A single query atom or a filter. */
export type QueryTarget = QueryAtom<any, any> | QueryFilter

/** The operations of the {@link Queries} service. */
export interface QueriesApi {
  /** Refetches observed matches; marks unobserved matches stale without fetching. */
  readonly invalidate: (target?: QueryTarget) => void
  /** Refetches every match now, ignoring `staleTime` (deduped against a running fetch). */
  readonly refetch: (target?: QueryTarget) => void
  /** Writes data, cancelling an in-flight fetch; a missing key is created without fetching. */
  readonly setData: <A>(atom: QueryAtom<A, any>, value: A) => void
  /** Like `setData`, with the value computed from the current data. */
  readonly updateData: <A>(atom: QueryAtom<A, any>, f: (previous: Option.Option<A>) => A) => void
  /** The cached data; `Option.none` for a missing key (never starts a fetch). */
  readonly getData: <A>(atom: QueryAtom<A, any>) => Option.Option<A>
  /** Interrupts in-flight fetches and pending retries of the matches, keeping their previous value. */
  readonly cancel: (target?: QueryTarget) => void
  /** Restores `Initial` and drops the registry entry; an observed match refetches from `Initial`. */
  readonly reset: (target?: QueryTarget) => void
}

/** The query client service bound to a store; build it with {@link make}. */
export class Queries extends Context.Tag('@sleekstack/query/Queries')<Queries, QueriesApi>() {}

const matches = (store: AtomStore, target: QueryTarget = {}): Array<QueryEntry> => {
  const all = [...entries(store).values()]
  if (TypeId in target) return all.filter((e) => e.id === target[TypeId].id)
  const prefix = target.prefix?.map((p) => canonicalKey([p]))
  return all.filter((e) =>
    (!prefix || (prefix.length <= e.tuple.length && prefix.every((p, i) => p === canonicalKey([e.tuple[i]]))))
    && (!target.predicate || target.predicate(e)))
}

/**
 * Builds the {@link Queries} service over `store`.
 *
 * @param store - The store whose queries the service manages.
 * @returns The service; provide it with `Layer.succeed(Queries, Queries.make(store))`.
 */
export const make = (store: AtomStore): QueriesApi => {
  const cancelOne = (e: QueryEntry) => {
    if (!store.get(e.atom).waiting) return
    withOverride(store, e.id, 'skip', () => { store.refresh(e.atom); store.get(e.atom) })
  }
  const getData = <A>(atom: QueryAtom<A, any>): Option.Option<A> => {
    const e = entries(store).get(atom[TypeId].id)
    return e ? Result.value(store.get(atom)) : Option.none()
  }
  const setData = <A>(atom: QueryAtom<A, any>, value: A) => {
    const e = entries(store).get(atom[TypeId].id)
    if (e) cancelOne(e)
    // the store pulls before writing: skip that build so a missing key never fetches
    withOverride(store, atom[TypeId].id, 'skip', () => store.set(atom, value))
  }
  return {
    invalidate: (target) => {
      for (const e of matches(store, target)) {
        if (e.observers > 0) { trigger(store, e.atom, true); continue }
        cancelOne(e) // a fetch started before the invalidation must not mark the entry fresh
        e.updatedAt = undefined
      }
    },
    refetch: (target) => {
      for (const e of matches(store, target)) { trigger(store, e.atom, true); store.get(e.atom) }
    },
    setData,
    updateData: (atom, f) => setData(atom, f(getData(atom))),
    getData,
    cancel: (target) => { for (const e of matches(store, target)) cancelOne(e) },
    reset: (target) => {
      const registry = entries(store) as Map<string, QueryEntry>
      for (const e of matches(store, target)) {
        e.updatedAt = undefined
        // rebuild as Initial (interrupting any fetch), then invalidate: observed nodes refetch from
        // Initial at once, unobserved ones stay dirty and drop their entry
        withOverride(store, e.id, 'clear', () => { store.refresh(e.atom); store.get(e.atom) })
        store.refresh(e.atom)
        if (!e.live) registry.delete(e.id)
      }
    },
  }
}
