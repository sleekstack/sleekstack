/**
 * apps/showcase/app/atoms/page.tsx
 *
 * Atom SSR (R5): the server component awaits `prefetchAtoms` and seeds the client `LayerProvider` via `hydrate`,
 * so the HTML carries the values and the client never runs the seeded Effect.
 */
import { prefetchAtoms } from '@sleekstack/next'
import '../../src/delivery/runtime.server'
import { SsrAtoms } from '../../src/client/components/SsrAtoms'
import { greeting, serverTime } from '../../src/client/services/ssr-atoms'

export const dynamic = 'force-dynamic'

export default async function AtomsPage() {
  const snapshot = await prefetchAtoms([serverTime, greeting])
  return (
    <main>
      <h1>Atom SSR</h1>
      <SsrAtoms snapshot={snapshot} />
    </main>
  )
}
