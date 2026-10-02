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
  /** Writes data (or an updater of the current data); a missing key is created without fetching. */
  readonly setData: <A>(atom: QueryAtom<A, any>, value: A | ((previous: Option.Option<A>) => A)) => void
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
    withOverride(e.id, 'skip', () => { store.refresh(e.atom); store.get(e.atom) })
  }
  return {
    invalidate: (target) => {
      for (const e of matches(store, target)) {
        if (e.observers > 0) trigger(store, e.atom, true)
        else e.updatedAt = undefined
      }
    },
    refetch: (target) => {
      for (const e of matches(store, target)) { trigger(store, e.atom, true); store.get(e.atom) }
    },
    setData: (atom, value) => {
      const update = typeof value === 'function'
        ? (value as (previous: Option.Option<unknown>) => unknown)
        : () => value
      const previous = Option.flatMap(Option.fromNullable(entries(store).get(atom[TypeId].id)), (e) => Result.value(store.get(e.atom)))
      // the store pulls before writing: skip that build so a missing key never fetches
      withOverride(atom[TypeId].id, 'skip', () => store.set(atom, update(previous) as never))
    },
    getData: (atom) => {
      const e = entries(store).get(atom[TypeId].id)
      return e ? Result.value(store.get(atom)) : Option.none()
    },
    cancel: (target) => { for (const e of matches(store, target)) cancelOne(e) },
    reset: (target) => {
      const registry = entries(store) as Map<string, QueryEntry>
      for (const e of matches(store, target)) {
        e.updatedAt = undefined
        withOverride(e.id, 'reset', () => store.refresh(e.atom))
        if (!e.live) registry.delete(e.id)
      }
    },
  }
}
