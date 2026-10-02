/**
 * packages/react/src/HydrateQueries.tsx
 *
 * `<HydrateQueries state>`: hands `prefetch`ed query state to the query store. On the client it stages
 * the entries on the app-scoped store (each query seeds on its first read, before render); on the server
 * it fills the provider's dehydrated map the server query hooks read. Nested providers share both.
 * Entries the server fetched lazily (un-prefetched reads under it) travel in a JSON script after the
 * children, keyed by `useId`, so the client stages them too.
 */

import React, { useContext, useId } from 'react'
import { Hydrate } from '@sleekstack/query'
import { QueryStoreContext, type ProviderState } from './context'
import { serverMap, useQueryStore } from './query'

const json = (entries: Hydrate.Dehydrated) => JSON.stringify(entries).replace(/</g, '\\u003c')

// Server only: renders after the children's first pass and waits for the lazy fetches they started.
// ponytail: a lazy read first reached after this renders (behind a deeper suspension) is not transferred; prefetch it.
function LazyState({ id, provider }: { readonly id: string; readonly provider: ProviderState }) {
  const slots = [...serverMap(provider).values()].filter((s) => s.lazy)
  const running = slots.filter((s) => !s.done && s.error === undefined).map((s) => s.promise!)
  if (running.length > 0) throw Promise.all(running)
  const entries = slots.flatMap((s) => (s.entry ? [s.entry] : []))
  return <script id={id} type="application/json" dangerouslySetInnerHTML={{ __html: json(entries) }} />
}

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
  const id = useId()
  if (typeof window === 'undefined') {
    const provider = useContext(QueryStoreContext)
    if (provider === null) throw new Error('HydrateQueries needs a <LayerProvider> above it.')
    const m = serverMap(provider)
    // decoded on read; an entry failing its Schema is refetched
    for (const entry of state) if (!m.get(entry.key)?.entry) m.set(entry.key, { entry })
    return <>{children}<LazyState id={id} provider={provider} /></>
  }
  const store = useQueryStore('HydrateQueries')
  Hydrate.hydrate(store, state)
  const transferred = document.getElementById(id)?.textContent ?? '[]'
  Hydrate.hydrate(store, JSON.parse(transferred) as Hydrate.Dehydrated)
  return <>{children}<script id={id} type="application/json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: transferred }} /></>
}
