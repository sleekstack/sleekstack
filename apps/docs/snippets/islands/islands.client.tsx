'use client'
import { defineIslands } from '@sleekstack/islands'
import { LocalLayer, SharedLayer } from './services'

// Each `import()` is its own chunk, downloaded when that Island's trigger fires.
// App-scope entries: shared by every Island of this registry on the page.
export const Island = defineIslands({ counter: () => import('./Counter') }, { provide: [SharedLayer] })

// Component-scope `provide` holds functions, so it is passed from a client component, not across the RSC boundary.
export function Counters() {
  return (
    <>
      <Island name="counter" props={{ label: 'a' }} hydrate="interaction" provide={[LocalLayer]} />
      <Island name="counter" props={{ label: 'b' }} hydrate="visible" provide={[LocalLayer]} />
    </>
  )
}

// page.tsx (Server Component): `name` and serialisable `props` only.
// <Island name="counter" props={{ label: 'c' }} hydrate="idle" />
