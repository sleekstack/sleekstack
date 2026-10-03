'use client'
/**
 * apps/showcase/app/providers.tsx
 *
 * The app-level `LayerProvider` under `<React.StrictMode>`. `key={demoMode}`
 * remounts the whole subtree when the demo-mode cookie flips, releasing every
 * open component scope beneath it. Demo mode shadows services on the server
 * only (delivery/demo-mode.ts); the client has no ambient services to swap.
 * `<HydrateQueries>` seeds the app store's query cache with the page's prefetch.
 */
import React from 'react'
import { HydrateQueries, LayerProvider } from '@sleekstack/react'
import type { Hydrate } from '@sleekstack/query'

export function Providers({ demoMode, state = [], children }: {
  readonly demoMode: boolean
  readonly state?: Hydrate.Dehydrated
  readonly children: React.ReactNode
}) {
  return (
    <React.StrictMode>
      <LayerProvider key={String(demoMode)} provide={[]}>
        <HydrateQueries state={state}>{children}</HydrateQueries>
      </LayerProvider>
    </React.StrictMode>
  )
}
