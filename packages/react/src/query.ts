/**
 * packages/react/src/query.ts
 *
 * Query hooks over `@sleekstack/query`. Queries live in the app-scoped store (the root LayerProvider's,
 * or the nearest QueryProvider's), so nested providers share one cache. On the server the hooks read the
 * provider's dehydrated map (filled by `<HydrateQueries>`) instead of a store, and suspend on an un-prefetched
 * key while the registered server runner fetches it.
 */

import React, { useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { Cause, Chunk, Option, type Exit } from 'effect'
import { Atom, Result, type AtomStore } from '@sleekstack/core'
import { Hydrate, Mutation, Queries, Query } from '@sleekstack/query'
import { ProviderContext, QueryStoreContext, type ProviderState } from './context'
import { AtomsClientOnly } from './atoms'

function useQueryState(hook: string): ProviderState {
  const state = useContext(QueryStoreContext)
  if (state === null) throw new Error(`${hook} needs a <LayerProvider> above this component: queries live in the root provider's store.`)
  return state
}

/** @internal */
export function useQueryStore(hook: string): AtomStore {
  if (typeof window === 'undefined') {
    throw new AtomsClientOnly({ message: `${hook} ran during a server render; only query reads render on the server.` })
  }
  const state = useQueryState(hook)
  if (state.atoms) return state.atoms
  if (state.scopeState.status === 'rejected') throw state.scopeState.error
  state.start()
  throw state.scope
}

/**
 * Marks the nearest `LayerProvider` as the query store for its subtree (instead of the root's).
 *
 * @example
 * ```tsx
 * <LayerProvider provide={[feature]}><QueryProvider>...</QueryProvider></LayerProvider>
 * ```
 */
export function QueryProvider({ children }: { readonly children?: React.ReactNode }) {
  const state = useContext(ProviderContext)
  if (state === null) throw new Error('QueryProvider needs a <LayerProvider> above it.')
  return React.createElement(QueryStoreContext.Provider, { value: state }, children)
}

const clients = new WeakMap<AtomStore, Queries.QueriesApi>()

/**
 * The `Queries` client bound to the query store.
 *
 * @returns `invalidate`, `refetch`, `setData`, `updateData`, `getData`, `cancel`, `reset`.
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
 */
export function useQueries(): Queries.QueriesApi {
  const store = useQueryStore('useQueries')
  let c = clients.get(store)
  if (!c) clients.set(store, (c = Queries.make(store)))
  return c
}

type QueryResult<A, E> = Result.Result<A, E | Atom.ScopeError>
const LOADING: Result.Result<never, never> = Result.initial(true)

/**
 * Observes a query and returns its `Result` (refetch triggers run while mounted).
 *
 * @param atom - The query atom.
 * @returns The current `Result`.
 * @throws `Error` outside a `LayerProvider`. On the server it reads hydrated data (suspending on an un-prefetched key).
 */
export function useQueryResult<A, E>(atom: Query.QueryAtom<A, E>): QueryResult<A, E> {
  return useObserved('useQueryResult', atom).result
}

type ServerSlot = { entry?: Hydrate.DehydratedEntry; promise?: Promise<void>; done?: boolean }
const serverMaps = new WeakMap<ProviderState, Map<string, ServerSlot>>()
/** @internal The server-render dehydrated map of a query store (shared by nested providers). */
export const serverMap = (state: ProviderState): Map<string, ServerSlot> => {
  let m = serverMaps.get(state)
  if (!m) serverMaps.set(state, (m = new Map()))
  return m
}

// Server branch: no store. A hydrated entry renders as is; a missing (or Schema-failing) one suspends on a fetch.
function serverResult<A, E>(state: ProviderState, atom: Query.QueryAtom<A, E>): QueryResult<A, E> {
  const key = atom[Query.TypeId].key
  const m = serverMap(state)
  const slot = m.get(key) ?? {}
  const decoded = slot.entry && Hydrate.decode(atom, slot.entry)
  if (decoded) return decoded
  if (slot.done) return LOADING // fetched but not dehydratable (failure): the client fetches it
  if (!slot.promise) {
    slot.promise = Hydrate.serverRun([atom]).then(
      ([entry]) => { slot.entry = entry; slot.done = true },
      () => { slot.done = true },
    )
    m.set(key, slot)
  }
  throw slot.promise
}

const noop = () => {}

function useObserved<A, E>(hook: string, atom: Query.QueryAtom<A, E>): { store: AtomStore | undefined; result: QueryResult<A, E> } {
  if (typeof window === 'undefined') return { store: undefined, result: serverResult(useQueryState(hook), atom) }
  const store = useQueryStore(hook)
  Hydrate.apply(store, atom) // seeds a staged <HydrateQueries> entry before the first read
  const subscribe = useCallback((listener: () => void) => {
    const release = claim(store, atom) ?? Query.observe(store, atom)
    const unsubscribe = store.subscribe(atom, listener)
    return () => { unsubscribe(); park(store, atom, release, 0) } // StrictMode remounts synchronously
  }, [store, atom])
  // A render never builds a missing query: the first observer does, so it is not then refetched as "stale on mount".
  const getSnapshot = useCallback(
    () => (Query.entries(store).has(atom[Query.TypeId].id) ? store.get(atom) : LOADING) as QueryResult<A, E>,
    [store, atom],
  )
  return { store, result: useSyncExternalStore(subscribe, getSnapshot, getSnapshot) }
}

/** Plain values of a query. */
export interface UseQuery<A, E> {
  readonly data: A | undefined
  /** The typed failure (a previous `data` may still be present). */
  readonly error: E | Atom.ScopeError | undefined
  /** No value yet. */
  readonly isPending: boolean
  /** A fetch (first load or background refetch) is running. */
  readonly isFetching: boolean
  /** Refetches now, ignoring `staleTime` (deduped against a running fetch). */
  readonly refetch: () => void
}

const view = <A, E>(store: AtomStore | undefined, atom: Query.QueryAtom<A, E>, result: QueryResult<A, E>) => {
  let error: E | Atom.ScopeError | undefined
  if (result._tag === 'Failure') {
    const typed = Cause.failureOption(result.cause)
    // any defect (even beside a typed failure) goes to the error boundary
    const defects = Cause.defects(result.cause)
    if (Chunk.isNonEmpty(defects)) throw Chunk.headNonEmpty(defects)
    if (Option.isNone(typed)) throw Cause.squash(result.cause)
    error = typed.value
  }
  return {
    data: Option.getOrUndefined(Result.value(result)),
    error,
    isPending: result._tag === 'Initial',
    isFetching: result.waiting,
    refetch: store ? () => Query.trigger(store, atom, true) : noop,
  }
}

/**
 * Reads a query; never suspends.
 *
 * @param atom - The query atom, e.g. `todo('t1')`.
 * @returns `data`, `error`, `isPending`, `isFetching`, `refetch`.
 * @throws A defect (non-typed failure) to the nearest error boundary.
 * @throws `Error` outside a `LayerProvider`. On the server it reads hydrated data (suspending on an un-prefetched key).
 *
 * @example
 * ```tsx
 * const Title = () => { const { data, isPending } = useQuery(todo('t1')); return <span>{isPending ? '...' : data!.title}</span> }
 * ```
 */
export function useQuery<A, E>(atom: Query.QueryAtom<A, E>): UseQuery<A, E> {
  const { store, result } = useObserved('useQuery', atom)
  return view(store, atom, result)
}

// A released observation is parked briefly so the next subscriber takes it over instead of observing anew (which
// refetches a stale entry "on mount"): until the next task after an unmount (StrictMode's synchronous remount), and
// for HANDOFF_MS after a Suspense load (React throttles the retry's commit ~300 ms).
// ponytail: a new observer claiming a just-loaded suspension's observation also skips the mount refetch (the data is fresh).
const HANDOFF_MS = 400
const parked = new WeakMap<AtomStore, WeakMap<object, { readonly release: () => void; readonly timer: ReturnType<typeof setTimeout> }>>()
const parkedFor = (store: AtomStore) => {
  let m = parked.get(store)
  if (!m) parked.set(store, (m = new WeakMap()))
  return m
}
const claim = (store: AtomStore, atom: object): (() => void) | undefined => {
  const m = parkedFor(store)
  const p = m.get(atom)
  if (!p) return undefined
  m.delete(atom)
  clearTimeout(p.timer)
  return p.release
}
function park(store: AtomStore, atom: object, release: () => void, ms: number) {
  claim(store, atom)?.()
  const m = parkedFor(store)
  m.set(atom, { release, timer: setTimeout(() => { if (m.get(atom)?.release === release) m.delete(atom); release() }, ms) })
}

const suspensions = new WeakMap<AtomStore, WeakMap<object, Promise<void>>>()
const loaded = (store: AtomStore, atom: Query.QueryAtom<any, any>): Promise<void> => {
  let perStore = suspensions.get(store)
  if (!perStore) suspensions.set(store, (perStore = new WeakMap()))
  let p = perStore.get(atom)
  if (!p) {
    p = new Promise<void>((resolve) => {
      let done = false
      let release: (() => void) | undefined
      const check = () => {
        if (done || !release || store.get(atom)._tag === 'Initial') return
        done = true
        perStore!.delete(atom)
        park(store, atom, release, HANDOFF_MS) // the retried render's subscription takes the observation over
        resolve()
      }
      release = Query.observe(store, atom, check)
      check() // a synchronous fetch settles during observe, without notifying
    })
    perStore.set(atom, p)
  }
  return p
}

/**
 * Reads a query, suspending only while it has no value (`Initial`); a background refetch never suspends.
 * A `Failure` with a previous value returns that stale `data` plus the `error`.
 *
 * @param atom - The query atom.
 * @returns `data` (always present), `error`, `isFetching`, `refetch`.
 * @throws `Cause.squash` of a `Failure` with no previous value, to the nearest error boundary.
 * @throws `Error` outside a `LayerProvider`. On the server it reads hydrated data (suspending on an un-prefetched key).
 */
export function useQuerySuspense<A, E>(atom: Query.QueryAtom<A, E>): UseQuery<A, E> & { readonly data: A } {
  const { store, result } = useObserved('useQuerySuspense', atom)
  if (result._tag === 'Initial') {
    if (!store) throw new Error('useQuerySuspense: the query has no server data; rendering it on the client.')
    throw loaded(store, atom)
  }
  if (result._tag === 'Failure' && Option.isNone(result.previousValue)) throw Cause.squash(result.cause)
  return view(store, atom, result) as UseQuery<A, E> & { readonly data: A }
}

/**
 * {@link useQuery} plus paging for a `Query.infinite` atom.
 *
 * @param atom - The infinite query atom.
 * @returns `useQuery`'s values plus `fetchNext`, `fetchPrevious` (no-ops before the first page or while a fetch runs),
 * `isFetchingNext`, `isFetchingPrevious`.
 */
export function useInfiniteQuery<A, P, E>(atom: Query.InfiniteQueryAtom<A, P, E>) {
  const { store, result } = useObserved('useInfiniteQuery', atom)
  return {
    ...view(store, atom, result),
    isFetchingNext: store ? Query.isFetchingNext(store, atom) : false,
    isFetchingPrevious: store ? Query.isFetchingPrevious(store, atom) : false,
    fetchNext: store ? () => Query.fetchNext(store, atom) : noop,
    fetchPrevious: store ? () => Query.fetchPrevious(store, atom) : noop,
  }
}

/** A component's handle on a mutation. */
export interface UseMutation<I, A, E> {
  /** Starts a call (run `onMutate` here, in the event handler); resolves with its Exit. */
  readonly mutate: (input: I) => Promise<Exit.Exit<A, E>>
  readonly state: Mutation.MutationState<A, E>
  readonly isPending: boolean
  /** Returns the state to `idle`. */
  readonly reset: () => void
}

const IDLE: Mutation.MutationState<never, never> = { _tag: 'idle' }
const noSubscribe = () => () => {}

/**
 * Runs a mutation against the query store. The runner is made on commit, so StrictMode's double mount
 * never runs `onMutate` twice; unmount releases it (in-flight calls keep running unless `interruptOnUnmount`).
 *
 * @param mutation - A `Mutation.make` definition.
 * @returns `mutate`, `state`, `isPending`, `reset`.
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useMutation(rename)
 * <button disabled={isPending} onClick={() => mutate({ id: 't1', title: 'New' })}>rename</button>
 * ```
 */
export function useMutation<I, A, E, R>(mutation: Mutation.Mutation<I, A, E, R>): UseMutation<I, A, E> {
  const store = useQueryStore('useMutation')
  const [runner, setRunner] = useState<Mutation.Runner<I, A, E> | null>(null)
  useEffect(() => {
    const r = Mutation.runner(store, mutation)
    setRunner(r)
    return () => r.release()
  }, [store, mutation])
  const subscribe = useCallback((l: () => void) => (runner ? store.subscribe(runner.state, l) : noSubscribe()), [store, runner])
  const getSnapshot = useCallback(() => (runner ? store.get(runner.state) : IDLE), [store, runner])
  const state = useSyncExternalStore(subscribe, getSnapshot) as Mutation.MutationState<A, E>
  const mutate = useCallback((input: I) => {
    if (!runner) throw new Error('useMutation: mutate called before the component committed.')
    return runner.mutate(input)
  }, [runner])
  const reset = useCallback(() => runner?.reset(), [runner])
  return { mutate, state, isPending: state._tag === 'pending', reset }
}
