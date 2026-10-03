/**
 * packages/kit/src/next/prefetch.ts
 *
 * Kit `prefetch`: runs `serializable` cached queries in a request scope (the configured runtime plus
 * `provide`) and returns the `Dehydrated` state for `<HydrateQueries state>`. Importing it registers the
 * kit request scope as the server runner, so an un-prefetched read in a server render resolves the app's
 * services (configured runtime only: per-call `provide` cannot reach a render).
 */

import { runEffect } from '@sleekstack/next'
import { Hydrate, Query } from '@sleekstack/query'
import { normalize, SleekStackError } from '../errors'
import { unwrap, validateProvide } from '../module'
import { coreQuery, isSerializable, type CachedQuery, type Dehydrated } from '../query'
import type { OperationOptions } from './action'
import { requestLayer } from './runtime'

/** Options for {@link prefetch}. */
export interface PrefetchOptions {
  /** Also send failed queries (the client shows the failure until its refetch settles). Default false. */
  readonly failures?: boolean
  /** Built in the request scope for this call, as in `query`. */
  readonly provide?: OperationOptions['provide']
}

const run = async (atoms: ReadonlyArray<ReturnType<typeof coreQuery>>, options: PrefetchOptions): Promise<Hydrate.Dehydrated> => {
  const raw = typeof options.provide === 'function' ? await options.provide() : (options.provide ?? [])
  try {
    validateProvide(raw)
    return await runEffect(Hydrate.prefetch(atoms, { failures: options.failures ?? false }), { request: requestLayer(unwrap(raw)) })
  } catch (e) {
    throw normalize(e)
  }
}

/**
 * Fetches `queries` on the server and returns their state for `<HydrateQueries state>`.
 *
 * @param queries - Queries from `cachedQuery({ serializable })` families.
 * @param options - `failures` opt-in and per-call `provide`.
 * @returns A promise of the `Dehydrated` state.
 * @throws {@link SleekStackError} (rejection) with code `Unknown` naming the query when one is not `serializable`, or before `configureRuntime`.
 *
 * @example
 * ```tsx
 * import { prefetch } from '@sleekstack/kit/next'
 * import { HydrateQueries } from '@sleekstack/kit/react'
 *
 * export default async function Page() {
 *   return <HydrateQueries state={await prefetch([todo('t1')])}><Todo id="t1" /></HydrateQueries>
 * }
 * ```
 */
export async function prefetch(queries: ReadonlyArray<CachedQuery<any>>, options: PrefetchOptions = {}): Promise<Dehydrated> {
  const atoms = queries.map(coreQuery)
  for (const atom of atoms) {
    if (!isSerializable(atom)) {
      throw new SleekStackError('Unknown', `Query ${atom[Query.TypeId].key} is not serializable: set \`serializable\` on its cachedQuery to prefetch it.`)
    }
  }
  return (await run(atoms, options)) as unknown as Dehydrated
}

Hydrate.setServerRunner((atoms) => run(atoms, { failures: true }))
