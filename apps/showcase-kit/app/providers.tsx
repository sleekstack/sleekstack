'use client'
/**
 * apps/showcase-kit/app/providers.tsx
 *
 * R7/R8/R9: the app-level `LayerProvider` (no parent, so it owns both the
 * app scope and its own component scope — `kit/react`)
 * under `<React.StrictMode>`. `key={demoMode}` remounts the whole subtree
 * when the demo-mode cookie flips (R9), releasing every open component
 * scope beneath it. `provide` picks the real or mock client `Clock` — the
 * same `demoMode` value the server used to pick `demo.server.ts`'s
 * `MockClockDef`, so both sides shadow together with no separate API.
 * `<HydrateQueries>` seeds the query cache with the page's prefetch, if any.
 */
import React from 'react'
import type { Dehydrated } from '@sleekstack/kit'
import { HydrateQueries, LayerProvider } from '@sleekstack/kit/react'
import { MockClientClockLayer, RealClientClockLayer } from '../src/client/component-services'
import { OptimisticScope } from '../src/client/board-query'

export function Providers({ demoMode, state, children }: {
  readonly demoMode: boolean
  readonly state?: Dehydrated
  readonly children: React.ReactNode
}) {
  return (
    <React.StrictMode>
      <LayerProvider key={String(demoMode)} provide={[demoMode ? MockClientClockLayer : RealClientClockLayer]}>
        <OptimisticScope>{state ? <HydrateQueries state={state}>{children}</HydrateQueries> : children}</OptimisticScope>
      </LayerProvider>
    </React.StrictMode>
  )
}
