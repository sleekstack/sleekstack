/**
 * packages/react/src/HydrateQueries.tsx
 *
 * `<HydrateQueries state>`: hands `prefetch`ed query state to the query store. On the client it stages
 * the entries on the app-scoped store (each query seeds on its first read, before render); on the server
 * it fills the provider's dehydrated map the server query hooks read. Nested providers share both.
 */

import React, { useContext } from 'react'
import { Hydrate } from '@sleekstack/query'
import { QueryStoreContext } from './context'
import { serverMap, useQueryStore } from './query'

/**
 * Hydrates the query store with server-prefetched state.
 *
 * @param props.state - The `Dehydrated` state from `prefetch`.
 * @throws `Error` outside a `LayerProvider`.
 *
 * @example
 * ```tsx
 * <HydrateQueries state={await prefetch([todo('t1')])}><Todo id="t1" /></HydrateQueries>
 * ```
 */
export function HydrateQueries({ state, children }: { readonly state: Hydrate.Dehydrated; readonly children?: React.ReactNode }) {
  if (typeof window === 'undefined') {
    const provider = useContext(QueryStoreContext)
    if (provider === null) throw new Error('HydrateQueries needs a <LayerProvider> above it.')
    const m = serverMap(provider)
    for (const entry of state) if (!m.get(entry.key)?.entry) m.set(entry.key, { entry, done: true })
  } else {
    Hydrate.hydrate(useQueryStore('HydrateQueries'), state)
  }
  return <>{children}</>
}
