'use client'
/**
 * apps/showcase/app/providers.tsx
 *
 * R7/R8/R9: the app-level `LayerProvider` (no parent, so it owns both the
 * app scope and its own component scope — `packages/react/src/LayerProvider.tsx:83-92`)
 * under `<React.StrictMode>`. `key={demoMode}` remounts the whole subtree
 * when the demo-mode cookie flips (R9), releasing every open component
 * scope beneath it.
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
