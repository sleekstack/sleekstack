/**
 * packages/react/src/query.ts
 *
 * Query hooks over `@sleekstack/query`. Queries live in the app-scoped store (the root LayerProvider's,
 * or the nearest QueryProvider's), so nested providers share one cache. Client only (SSR is the
 * hydration task's).
 */

import React, { useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { Cause, Option, type Exit } from 'effect'
import { Atom, Result, type AtomStore } from '@sleekstack/core'
import { Mutation, Queries, Query } from '@sleekstack/query'
import { ProviderContext, QueryStoreContext } from './context'
import { AtomsClientOnly } from './atoms'

function useQueryStore(hook: string): AtomStore {
  if (typeof window === 'undefined') {
    throw new AtomsClientOnly({ message: `${hook} ran during a server render; query hooks are client only here.` })
  }
  const state = useContext(QueryStoreContext)
  if (state === null) throw new Error(`${hook} needs a <LayerProvider> above this component: queries live in the root provider's store.`)
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
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
 */
export function useQueryResult<A, E>(atom: Query.QueryAtom<A, E>): QueryResult<A, E> {
  return useObserved('useQueryResult', atom).result
}

function useObserved<A, E>(hook: string, atom: Query.QueryAtom<A, E>) {
  const store = useQueryStore(hook)
  const subscribe = useCallback((listener: () => void) => {
    const release = claim(store, atom) ?? Query.observe(store, atom)
    const unsubscribe = store.subscribe(atom, listener)
    return () => { unsubscribe(); park(store, atom, release) }
  }, [store, atom])
  // A render never builds a missing query: the first observer does, so it is not then refetched as "stale on mount".
  const getSnapshot = useCallback(
    () => (Query.entries(store).has(atom[Query.TypeId].id) ? store.get(atom) : LOADING) as QueryResult<A, E>,
    [store, atom],
  )
  return { store, result: useSyncExternalStore(subscribe, getSnapshot) }
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

const view = <A, E>(store: AtomStore, atom: Query.QueryAtom<A, E>, result: QueryResult<A, E>) => {
  let error: E | Atom.ScopeError | undefined
  if (result._tag === 'Failure') {
    const typed = Cause.failureOption(result.cause)
    if (Option.isNone(typed)) throw Cause.squash(result.cause) // defects go to the error boundary
    error = typed.value
  }
  return {
    data: Option.getOrUndefined(Result.value(result)),
    error,
    isPending: result._tag === 'Initial',
    isFetching: result.waiting,
    refetch: () => Query.trigger(store, atom, true),
  }
}

/**
 * Reads a query; never suspends.
 *
 * @param atom - The query atom, e.g. `todo('t1')`.
 * @returns `data`, `error`, `isPending`, `isFetching`, `refetch`.
 * @throws A defect (non-typed failure) to the nearest error boundary.
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
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

// An observation outlives its observer by HANDOFF_MS so a StrictMode remount or a Suspense retry takes it over
// instead of observing anew (which refetches a stale entry "on mount").
// ponytail: one parked observation per atom; a genuinely new observer within the window also skips the mount refetch.
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
function park(store: AtomStore, atom: object, release: () => void) {
  claim(store, atom)?.()
  const m = parkedFor(store)
  m.set(atom, { release, timer: setTimeout(() => { if (m.get(atom)?.release === release) m.delete(atom); release() }, HANDOFF_MS) })
}

const suspensions = new WeakMap<AtomStore, WeakMap<object, Promise<void>>>()
const loaded = (store: AtomStore, atom: Query.QueryAtom<any, any>): Promise<void> => {
  let perStore = suspensions.get(store)
  if (!perStore) suspensions.set(store, (perStore = new WeakMap()))
  let p = perStore.get(atom)
  if (!p) {
    p = new Promise<void>((resolve) => {
      let done = false
      const release = Query.observe(store, atom, () => {
        if (done || store.get(atom)._tag === 'Initial') return
        done = true
        perStore!.delete(atom)
        park(store, atom, release) // the retried render's subscription takes the observation over
        resolve()
      })
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
 * @throws `AtomsClientOnly` during a server render; `Error` outside a `LayerProvider`.
 */
export function useQuerySuspense<A, E>(atom: Query.QueryAtom<A, E>): UseQuery<A, E> & { readonly data: A } {
  const { store, result } = useObserved('useQuerySuspense', atom)
  if (result._tag === 'Initial') throw loaded(store, atom)
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
    isFetchingNext: Query.isFetchingNext(store, atom),
    isFetchingPrevious: Query.isFetchingPrevious(store, atom),
    fetchNext: () => Query.fetchNext(store, atom),
    fetchPrevious: () => Query.fetchPrevious(store, atom),
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
