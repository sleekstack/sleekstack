/**
 * packages/ui/src/query.ts
 *
 * `@sleekstack/ui/query`: TanStack query bindings. Each observed query's result lives in a writable atom so the
 * existing re-run path re-renders its readers; observers are shared per store and query hash, ref-counted by run scopes.
 */
import { Atom, type AtomStore } from '@sleekstack/core'
import { QueryClientTag } from '@sleekstack/query'
import { type QueryClient, type QueryKey, QueryObserver, type QueryObserverOptions, type QueryObserverResult } from '@tanstack/query-core'
import { Effect, Scope } from 'effect'
import { RenderScope, Store, useAtomValue } from './reactive'

type Entry = { observer: QueryObserver<any, any, any, any, any>; atom: Atom.Writable<any, any>; refs: number; unsubscribe: () => void }

const registries = new WeakMap<AtomStore, Map<string, Entry>>()

/** The scope's `QueryClient`. */
export const useQueryClient = (): Effect.Effect<QueryClient, never, QueryClientTag> => QueryClientTag

/** `useQuery` options: TanStack's, without `throwOnError` (an error is a result, never an Effect failure). */
export type UseQueryOptions<TQueryFnData, TError, TData, TQueryKey extends QueryKey> = Omit<QueryObserverOptions<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>, 'throwOnError'> & {
  throwOnError?: never
}

/**
 * Observes a query and re-renders the running component when its result changes. Under a run scope the observer is
 * shared by every run on the same store and query hash and dropped when the last using scope closes; without one
 * (server render) it reads the cache's current state and never subscribes.
 */
export const useQuery = <TQueryFnData = unknown, TError = Error, TData = TQueryFnData, TQueryKey extends QueryKey = QueryKey>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): Effect.Effect<QueryObserverResult<TData, TError>, never, QueryClientTag | Store> =>
  Effect.gen(function* () {
    const client = yield* QueryClientTag
    const store = yield* Store
    const scope = yield* RenderScope
    const defaulted = client.defaultQueryOptions(options as QueryObserverOptions<any, any, any, any, any>)
    if (!scope) return new QueryObserver(client, defaulted).getOptimisticResult(defaulted) as QueryObserverResult<TData, TError>
    let registry = registries.get(store)
    if (!registry) registries.set(store, (registry = new Map()))
    const hash = defaulted.queryHash
    let entry = registry.get(hash)
    if (entry) entry.observer.setOptions(defaulted)
    else {
      const observer = new QueryObserver(client, defaulted)
      entry = { observer, atom: Atom.make<unknown>(observer.getOptimisticResult(defaulted)), refs: 0, unsubscribe: () => {} }
      registry.set(hash, entry)
    }
    const e = entry
    const reg = registry
    if (e.refs++ === 0) e.unsubscribe = e.observer.subscribe((result) => store.set(e.atom, result))
    yield* Scope.addFinalizer(
      scope,
      Effect.sync(() => {
        if (--e.refs > 0) return
        e.unsubscribe()
        reg.delete(hash)
      }),
    )
    return (yield* useAtomValue(e.atom)) as QueryObserverResult<TData, TError>
  })
