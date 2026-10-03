// @sleekstack/kit/react public barrel. No Effect or core type is reachable from here.
import { createElement, useCallback, type ReactNode } from 'react'
import { useMutation as rqUseMutation, useQuery as rqUseQuery, type QueryFilters } from '@tanstack/react-query'
import { QueryClientLive, QueryClientTag } from '@sleekstack/query'
import { LayerProvider as CoreProvider, useService as coreUseService } from '@sleekstack/react'
import { normalize, type SleekStackError } from '../errors'
import { mutationFn, queryOpts, type CachedQuery, type Mutation } from '../query'
import { kit, KitProviderContext } from './hooks'

export { LayerProvider, useService, useServices, createAppScope, type LayerProviderProps, type AppScopeHandle } from './hooks'
export { useAtom, useAtomValue, useAtomSet, type SetAtom } from './atoms'

const QUERY_PROVIDE = [QueryClientLive()]

/**
 * Gives its subtree its own query client, built in the nearest `LayerProvider`'s scope, so queries and
 * mutations below resolve `yield*`ed Tags from that provider (instead of the root's).
 *
 * @example
 * ```tsx
 * import { LayerProvider, QueryProvider } from '@sleekstack/kit/react'
 *
 * export const Feature = ({ children }: { children: React.ReactNode }) => (
 *   <LayerProvider provide={[]}><QueryProvider>{children}</QueryProvider></LayerProvider>
 * )
 * ```
 */
export function QueryProvider(props: { readonly children?: ReactNode }) {
  return createElement(KitProviderContext.Provider, { value: true }, createElement(CoreProvider, { provide: QUERY_PROVIDE, owner: props }, props.children))
}

const useClient = () => kit(() => coreUseService(QueryClientTag))

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
 * Reads a {@link CachedQuery} from the nearest query client, fetching it when missing or stale. It does not
 * suspend on data: check `isPending`. It suspends while the `LayerProvider` scope builds.
 *
 * @param query - A query from a `cachedQuery()` family.
 * @returns `data`, `error`, `isPending`, `isFetching`, `refetch`.
 * @throws {@link SleekStackError} with code `Unknown` outside a `LayerProvider`. A fetch's own failure (including `MissingDependency`) is returned as `error`, not thrown.
 *
 * @example
 * ```tsx
 * import { cachedQuery } from '@sleekstack/kit'
 * import { useQuery } from '@sleekstack/kit/react'
 *
 * const todo = cachedQuery({ key: (id: string) => ['todo', id], fetch: function* (id) { return `todo ${id}` } })
 *
 * export function Todo() {
 *   const { data, isPending } = useQuery(todo('t1'))
 *   return <p>{isPending ? 'Loading' : data}</p>
 * }
 * ```
 */
export function useQuery<T>(query: CachedQuery<T>): QueryState<T> {
  const r = rqUseQuery(queryOpts(query), useClient())
  const refetch = r.refetch
  return {
    data: r.data as T | undefined,
    error: r.error === null ? undefined : normalize(r.error),
    isPending: r.isPending,
    isFetching: r.isFetching,
    refetch: useCallback(() => void refetch(), [refetch]),
  }
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
 * Runs a {@link Mutation} against the nearest query client.
 *
 * @param mutation - A `mutation()` definition.
 * @returns `mutate`, `data`, `error`, `isPending`, `reset`.
 * @throws {@link SleekStackError} with code `Unknown` outside a `LayerProvider`;
 *   `mutate` rejects with code `MissingDependency` when a `yield*`ed Tag is not provided and `Unknown` when `run` throws.
 *
 * @example
 * ```tsx
 * import { mutation } from '@sleekstack/kit'
 * import { useMutation } from '@sleekstack/kit/react'
 *
 * const rename = mutation({ run: function* (input: { id: string; title: string }) { return input.title } })
 *
 * export function Rename() {
 *   const { mutate, isPending } = useMutation(rename)
 *   return <button disabled={isPending} onClick={() => mutate({ id: 't1', title: 'New' })}>rename</button>
 * }
 * ```
 */
export function useMutation<I, T>(mutation: Mutation<I, T>): MutationHandle<I, T> {
  const m = rqUseMutation<T, unknown, I>({ mutationFn: mutationFn(mutation) }, useClient())
  const run = m.mutateAsync
  const mutate = useCallback((input: I) => run(input).catch((e: unknown) => { throw normalize(e) }), [run])
  return {
    mutate,
    data: m.data,
    error: m.error === null ? undefined : normalize(m.error),
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

const filters = (t: QueryTarget | undefined): QueryFilters =>
  t === undefined ? {} : 'prefix' in t ? { queryKey: t.prefix } : { queryKey: queryOpts(t).queryKey, exact: true }

/**
 * The nearest query client, e.g. to invalidate after a mutation.
 *
 * @returns `invalidate`, `refetch`, `setData`, `getData`.
 * @throws {@link SleekStackError} with code `Unknown` outside a `LayerProvider`.
 *
 * @example
 * ```tsx
 * import { mutation } from '@sleekstack/kit'
 * import { useMutation, useQueryClient } from '@sleekstack/kit/react'
 *
 * const rename = mutation({ run: function* (title: string) { return title } })
 *
 * export function Rename() {
 *   const client = useQueryClient()
 *   const { mutate } = useMutation(rename)
 *   const onClick = async () => {
 *     await mutate('New')
 *     client.invalidate({ prefix: ['todo'] })
 *   }
 *   return <button onClick={onClick}>rename</button>
 * }
 * ```
 */
export function useQueryClient(): QueryClient {
  const c = useClient()
  return {
    invalidate: (t) => void c.invalidateQueries(filters(t)),
    refetch: (t) => void c.refetchQueries(filters(t)),
    setData: (query, value) => void c.setQueryData(queryOpts(query).queryKey, value),
    getData: <T,>(query: CachedQuery<T>) => c.getQueryData(queryOpts(query).queryKey) as T | undefined,
  }
}
