'use client'
/**
 * apps/showcase/src/client/components/SsrAtoms.tsx
 *
 * The `/atoms` client side: a `LayerProvider` seeded via `hydrate` and readers for the serializable atoms.
 */
import { LayerProvider, useAtomValue } from '@sleekstack/react'
import { Result, type Snapshot } from '@sleekstack/core'
import { greeting, serverTime } from '../services/ssr-atoms'

function Readers() {
  const time = useAtomValue(serverTime)
  return (
    <dl>
      <dt>Greeting</dt>
      <dd data-testid="greeting">{useAtomValue(greeting)}</dd>
      <dt>Server time</dt>
      <dd data-testid="server-time">
        {Result.isSuccess(time) ? `run ${time.value.run} at ${time.value.at}` : 'loading'}
      </dd>
    </dl>
  )
}

export function SsrAtoms({ snapshot }: { readonly snapshot: Snapshot }) {
  return (
    <LayerProvider provide={[]} hydrate={snapshot}>
      <Readers />
    </LayerProvider>
  )
}
