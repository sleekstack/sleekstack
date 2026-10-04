'use client'
/**
 * apps/showcase/app/providers.tsx
 *
 * The app-level `LayerProvider` under `<React.StrictMode>`. `key={demoMode}`
 * remounts the whole subtree when the demo-mode cookie flips, releasing every
 * open component scope beneath it. Demo mode shadows services on the server
 * only (delivery/demo-mode.ts); the client has no ambient services to swap.
 * The layer's `QueryClientLive` backs `QueryProvider`; `<HydrationBoundary>` seeds it with the page's prefetch.
 */
import React from 'react'
import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query'
import { LayerProvider, QueryProvider } from '@sleekstack/react'
import { QueryClientLive } from '@sleekstack/query'

const provide = [QueryClientLive()]

export function Providers({ demoMode, state, children }: {
  readonly demoMode: boolean
  readonly state?: DehydratedState
  readonly children: React.ReactNode
}) {
  return (
    <React.StrictMode>
      <LayerProvider key={String(demoMode)} provide={provide}>
        <QueryProvider>
          <HydrationBoundary state={state}>{children}</HydrationBoundary>
        </QueryProvider>
      </LayerProvider>
    </React.StrictMode>
  )
}
