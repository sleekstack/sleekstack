'use client'
/**
 * apps/showcase/app/providers.tsx
 *
 * The app-level `LayerProvider` under `<React.StrictMode>`. `key={demoMode}`
 * remounts the whole subtree when the demo-mode cookie flips, releasing every
 * open component scope beneath it. Demo mode shadows services on the server
 * only (server/demo.server.ts); the client has no ambient services to swap.
 */
import React from 'react'
import { LayerProvider } from '@sleekstack/react'

export function Providers({ demoMode, children }: { readonly demoMode: boolean; readonly children: React.ReactNode }) {
  return (
    <React.StrictMode>
      <LayerProvider key={String(demoMode)} provide={[]}>
        {children}
      </LayerProvider>
    </React.StrictMode>
  )
}
