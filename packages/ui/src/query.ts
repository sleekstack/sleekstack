/**
 * packages/ui/src/query.ts
 *
 * `@sleekstack/ui/query`: TanStack query bindings. Each observed query's result lives in a writable atom so the
 * existing re-run path re-renders its readers; observers are shared per store and query hash, ref-counted by run scopes.
 */
import { Atom, type AtomStore } from '@sleekstack/core'
import { QueryClientTag } from '@sleekstack/query'
import {
  type MutateOptions,
  MutationObserver,
  type MutationObserverOptions,
  type MutationObserverResult,
  type QueryClient,
  type QueryKey,
  QueryObserver,
  type QueryObserverOptions,
  type QueryObserverResult,
} from '@tanstack/query-core'
import { Effect, Scope } from 'effect'
import { Collector, RenderScope, Store, useAtomValue } from './reactive'

type Entry = {
  observer: QueryObserver<any, any, any, any, any>
  atom: Atom.Writable<any, any>
  refs: number
  unsubscribe: () => void
}

const registries = new WeakMap<AtomStore, Map<string, Entry>>()

/** The scope's `QueryClient`. */
export const useQueryClient = (): Effect.Effect<QueryClient, never, QueryClientTag> => QueryClientTag

/** `useQuery` options: TanStack's, without `throwOnError` (an error is a result, never an Effect failure). */
export type UseQueryOptions<TQueryFnData, TError, TData, TQueryKey extends QueryKey> = Omit<
  QueryObserverOptions<TQueryFnData, TError, TData, TQueryFnData, TQueryKey>,
  'throwOnError'
> & {
  throwOnError?: never
}

/**
 * Observes a query and re-renders the running component when its result changes. Under a run scope the observer is
 * shared by every run on the same store and query hash and dropped when the last using scope closes; without one
 * (server render) it reads the cache's current state and never subscribes.
 */
export const useQuery = <
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): Effect.Effect<QueryObserverResult<TData, TError>, never, QueryClientTag | Store> =>
  Effect.gen(function* () {
    const client = yield* QueryClientTag
    const store = yield* Store
    const scope = yield* RenderScope
    const defaulted = client.defaultQueryOptions(options as QueryObserverOptions<any, any, any, any, any>)
    if (!scope)
      return new QueryObserver(client, defaulted).getOptimisticResult(defaulted) as QueryObserverResult<TData, TError>
    let registry = registries.get(store)
    if (!registry) registries.set(store, (registry = new Map()))
    const hash = defaulted.queryHash
    let entry = registry.get(hash)
    if (entry) entry.observer.setOptions(defaulted)
    else {
      const observer = new QueryObserver(client, defaulted)
      entry = {
        observer,
        atom: Atom.make<unknown>(observer.getOptimisticResult(defaulted)),
        refs: 0,
        unsubscribe: () => {},
      }
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

/** `useMutation` result: TanStack's result plus `mutateAsync`; `mutate` swallows the rejection (the error is in the result), `mutateAsync` keeps it. */
export type UseMutationResult<TData, TError, TVariables, TContext> = Omit<
  MutationObserverResult<TData, TError, TVariables, TContext>,
  'mutate'
> & {
  mutate: (variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TContext>) => void
  mutateAsync: MutationObserver<TData, TError, TVariables, TContext>['mutate']
}

type MutationEntry = {
  observer: MutationObserver<any, any, any, any>
  atom: Atom.Writable<any, any>
  refs: number
  unsubscribe: () => void
}
const mutations = new WeakMap<object, Array<MutationEntry>>()
// Call order within one run, so several `useMutation` calls in one component keep their own observer.
const calls = new WeakMap<Scope.Scope, number>()

/**
 * Observes a mutation for the running component instance: one unshared `MutationObserver` per instance and call site,
 * kept across its re-runs (so its status survives the re-run it causes) and unsubscribed when the instance's last run
 * scope closes. Without a run scope (server render) it returns the idle result and subscribes to nothing.
 */
export const useMutation = <TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  options: MutationObserverOptions<TData, TError, TVariables, TContext>,
): Effect.Effect<UseMutationResult<TData, TError, TVariables, TContext>, never, QueryClientTag | Store> =>
  Effect.gen(function* () {
    const client = yield* QueryClientTag
    const scope = yield* RenderScope
    const id = (yield* Collector)?.id
    type Result = UseMutationResult<TData, TError, TVariables, TContext>
    const withMutate = (
      observer: MutationObserver<TData, TError, TVariables, TContext>,
      result: MutationObserverResult<TData, TError, TVariables, TContext>,
    ): Result => ({
      ...result,
      mutateAsync: observer.mutate,
      mutate: (variables: TVariables, opts?: MutateOptions<TData, TError, TVariables, TContext>) =>
        void observer.mutate(variables, opts).catch(() => {}),
    })
    if (!scope || !id) {
      const observer = new MutationObserver<TData, TError, TVariables, TContext>(client, options)
      return withMutate(observer, observer.getCurrentResult())
    }
    const store = yield* Store
    const index = calls.get(scope) ?? 0
    calls.set(scope, index + 1)
    let list = mutations.get(id)
    if (!list) mutations.set(id, (list = []))
    let entry = list[index]
    if (entry) entry.observer.setOptions(options)
    else {
      const observer = new MutationObserver<TData, TError, TVariables, TContext>(client, options)
      const e: MutationEntry = {
        observer,
        atom: Atom.make<unknown>(withMutate(observer, observer.getCurrentResult())),
        refs: 0,
        unsubscribe: () => {},
      }
      e.unsubscribe = observer.subscribe((result) => store.set(e.atom, withMutate(observer, result)))
      list[index] = entry = e
    }
    const e = entry
    const l = list
    e.refs++
    yield* Scope.addFinalizer(
      scope,
      Effect.sync(() => {
        if (--e.refs > 0) return
        e.unsubscribe()
        delete l[index]
      }),
    )
    return (yield* useAtomValue(e.atom)) as UseMutationResult<TData, TError, TVariables, TContext>
  })
