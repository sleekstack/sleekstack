/**
 * packages/next/src/query.ts
 *
 * Server prefetch for `@sleekstack/query`: runs queries in a request scope through `runEffect` and
 * returns the `Dehydrated` state for `<HydrateQueries state>`. Importing it also registers `prefetch`
 * as the server runner, so a server render suspends on an un-prefetched query instead of failing. That lazy
 * fetch runs with the configured runtime only (no per-call `request` / `overrides` Layers, which a render
 * cannot see): prefetch queries that need request-scoped services.
 */

import { Hydrate, type Query } from '@sleekstack/query'
import type { RunEffectOptions } from '@sleekstack/runtime'
import { runEffect } from './runtime'

/**
 * Fetches `queries` on the configured runtime and dehydrates them.
 *
 * @param queries - Hydratable query atoms (see `Hydrate.hydratable`).
 * @param options - `failures` opt-in, plus per-call `request` / `overrides` Layers.
 * @returns A promise of the serializable `Dehydrated` state.
 * @throws `RuntimeNotConfigured` (rejection) before `configureRuntime`.
 *
 * @example
 * ```ts
 * const state = await prefetch([todo('t1')])
 * return <HydrateQueries state={state}><Todo id="t1" /></HydrateQueries>
 * ```
 */
export const prefetch = (
  queries: ReadonlyArray<Query.QueryAtom<any, any>>,
  options: Hydrate.DehydrateOptions & RunEffectOptions = {},
): Promise<Hydrate.Dehydrated> => runEffect(Hydrate.prefetch(queries, options), options)

Hydrate.setServerRunner((queries) => prefetch(queries))
