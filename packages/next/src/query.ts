/**
 * packages/next/src/query.ts
 *
 * Server prefetch for `@sleekstack/query`: prefetches TanStack queries in a request scope through
 * `runEffect` and returns the `DehydratedState` for `<HydrationBoundary state>`.
 */

import { QueryClientTag } from '@sleekstack/query'
import type { RunEffectOptions } from '@sleekstack/runtime'
import { dehydrate, type DehydratedState, type FetchQueryOptions } from '@tanstack/query-core'
import { Effect } from 'effect'
import { runEffect } from './runtime'

/**
 * Prefetches `queries` with the scope's `QueryClient` and dehydrates it. The client comes from
 * `QueryClientTag`, so the runtime must provide `QueryClientLive`: pass it as the `request` Layer for a
 * client built and disposed per call (an app-layer client is shared across requests). A rejecting
 * `queryFn` does not throw; its query is left out of the state.
 *
 * @param queries - TanStack query options (`queryKey`, `queryFn`, ...).
 * @param options - Per-call `request` / `overrides` Layers.
 * @returns A promise of the serializable `DehydratedState`.
 * @throws `RuntimeNotConfigured` (rejection) before `configureRuntime`; rejects like `runEffect` when the
 *   request scope fails to build.
 *
 * @example
 * ```ts
 * const state = await prefetchQueries([todoOptions('t1')], { request: QueryClientLive() })
 * return <HydrationBoundary state={state}><Todo id="t1" /></HydrationBoundary>
 * ```
 */
export const prefetchQueries = (
  queries: ReadonlyArray<FetchQueryOptions<any, any, any, any>>,
  options: RunEffectOptions = {},
): Promise<DehydratedState> =>
  runEffect(
    Effect.flatMap(QueryClientTag, (client) =>
      Effect.promise(async () => {
        await Promise.all(queries.map((q) => client.prefetchQuery(q)))
        return dehydrate(client)
      }),
    ),
    options,
  )
