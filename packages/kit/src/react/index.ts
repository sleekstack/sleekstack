// @sleekstack/kit/react public barrel. No Effect or core type is reachable from here.
import { useCallback } from 'react'
import { Exit, Option } from 'effect'
import { useMutation as coreUseMutation, useQueries, useQuery as coreUseQuery } from '@sleekstack/react'
import { normalize, type SleekStackError } from '../errors'
import { coreMutation, coreQuery, type CachedQuery, type Mutation } from '../query'

export { LayerProvider, useService, useServices, createAppScope, type LayerProviderProps, type AppScopeHandle } from './hooks'
export { useAtom, useAtomValue, useAtomSet, type SetAtom } from './atoms'

const isThenable = (x: unknown) => typeof (x as { then?: unknown } | null)?.then === 'function'
const kit = <T>(f: () => T): T => {
  try {
    return f()
  } catch (e) {
    if (isThenable(e)) throw e
    throw normalize(e)
  }
}

/** What {@link useQuery} returns. */
export interface QueryState<T> {
  readonly data: T | undefined
  /** The last fetch's failure (a previous `data` may still be present). */
  readonly error: SleekStackError | undefined
  /** No value yet. */
  readonly isPending: boolean
  /** A fetch (first load or background refetch) is running. */
  readonly isFetching: boolean
  /** Refetches now, ignoring `staleTime`. */
  readonly refetch: () => void
}

/**
 * Reads a {@link CachedQuery} from the nearest `LayerProvider`'s query store, fetching it when missing or stale.
 * Does not suspend: check `isPending`.
 *
 * @param query - A query from a `cachedQuery()` family.
 * @returns `data`, `error`, `isPending`, `isFetching`, `refetch`.
 * @throws {@link SleekStackError} with code `Unknown` outside a `LayerProvider` or during a server render without
 *   hydrated data. A fetch's own failure (including `MissingDependency`) is returned as `error`, not thrown.
 *
 * @example
 * ```tsx
 * const { data, isPending } = useQuery(todo('t1'))
 * ```
 */
export function useQuery<T>(query: CachedQuery<T>): QueryState<T> {
  const r = kit(() => coreUseQuery(coreQuery(query)))
  return { ...r, data: r.data as T | undefined, error: r.error === undefined ? undefined : normalize(r.error) }
}

/** What {@link useMutation} returns. */
export interface MutationHandle<I, T> {
  /** Runs a call; resolves with its value or rejects with a SleekStackError. */
  readonly mutate: (input: I) => Promise<T>
  /** The latest call's value. */
  readonly data: T | undefined
  /** The latest call's failure. */
  readonly error: SleekStackError | undefined
  readonly isPending: boolean
  /** Clears `data` and `error`. */
  readonly reset: () => void
}

/**
 * Runs a {@link Mutation} against the nearest `LayerProvider`'s query store. StrictMode's double mount runs nothing twice.
 *
 * @param mutation - A `mutation()` definition.
 * @returns `mutate`, `data`, `error`, `isPending`, `reset`.
 * @throws {@link SleekStackError} with code `Unknown` outside a `LayerProvider` or during a server render;
 *   `mutate` rejects with code `MissingDependency` when a `yield*`ed Tag is not provided and `Unknown` when `run` throws.
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useMutation(rename)
 * <button disabled={isPending} onClick={() => mutate({ id: 't1', title: 'New' })}>rename</button>
 * ```
 */
export function useMutation<I, T>(mutation: Mutation<I, T>): MutationHandle<I, T> {
  const m = kit(() => coreUseMutation(coreMutation(mutation)))
  const run = m.mutate
  const mutate = useCallback(async (input: I) => {
    const exit = await run(input)
    if (Exit.isSuccess(exit)) return exit.value as T
    throw normalize(exit.cause)
  }, [run])
  const s = m.state
  return {
    mutate,
    data: s._tag === 'success' ? (s.value as T) : undefined,
    error: s._tag === 'failure' ? normalize(s.cause) : undefined,
    isPending: m.isPending,
    reset: m.reset,
  }
}

/** Queries matched by an {@link QueryClient} call: one query, or every query whose key starts with `prefix`. */
export type QueryTarget = CachedQuery<any> | { readonly prefix: ReadonlyArray<unknown> }

/** What {@link useQueryClient} returns. */
export interface QueryClient {
  /** Marks matching queries stale and refetches the observed ones (all queries when no target). */
  readonly invalidate: (target?: QueryTarget) => void
  /** Refetches matching queries now. */
  readonly refetch: (target?: QueryTarget) => void
  /** Seeds a query's data. */
  readonly setData: <T>(query: CachedQuery<T>, value: T) => void
  /** A query's cached data, if any. */
  readonly getData: <T>(query: CachedQuery<T>) => T | undefined
}

const target = (t: QueryTarget | undefined) => (t === undefined || 'prefix' in t ? t : coreQuery(t))

/**
 * The query cache of the nearest `LayerProvider`'s query store, e.g. to invalidate after a mutation.
 *
 * @returns `invalidate`, `refetch`, `setData`, `getData`.
 * @throws {@link SleekStackError} with code `Unknown` outside a `LayerProvider` or during a server render.
 *
 * @example
 * ```tsx
 * const client = useQueryClient()
 * await mutate(input)
 * client.invalidate({ prefix: ['todo'] })
 * ```
 */
export function useQueryClient(): QueryClient {
  const q = kit(() => useQueries())
  return {
    invalidate: (t) => q.invalidate(target(t)),
    refetch: (t) => q.refetch(target(t)),
    setData: (query, value) => q.setData(coreQuery(query), value),
    getData: <T,>(query: CachedQuery<T>) => Option.getOrUndefined(q.getData(coreQuery(query))) as T | undefined,
  }
}
