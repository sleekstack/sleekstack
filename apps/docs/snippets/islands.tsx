// islands.client.tsx
'use client'
import { useSyncExternalStore } from 'react'
import { layer, tag } from '@sleekstack/kit'
import { useService } from '@sleekstack/kit/react'
import { defineIslands } from '@sleekstack/islands'

interface Tally { get(): number; bump(): void; subscribe(l: () => void): () => void }
const makeTally = (): Tally => {
  let n = 0
  const ls = new Set<() => void>()
  return { get: () => n, bump: () => { n++; ls.forEach((l) => l()) }, subscribe: (l) => (ls.add(l), () => void ls.delete(l)) }
}
const Shared = tag<Tally>('Shared')
const Local = tag<Tally>('Local')
const SharedLayer = layer(Shared, makeTally)
const LocalLayer = layer(Local, makeTally, [], { lifetime: 'component' })

// Normally in its own file, so `import()` makes it a separate chunk.
export default function Counter({ label }: { readonly label: string }) {
  const [shared, local] = [useService(Shared), useService(Local)]
  const s = useSyncExternalStore(shared.subscribe, shared.get, shared.get)
  const l = useSyncExternalStore(local.subscribe, local.get, local.get)
  return <button type="button" onClick={() => (shared.bump(), local.bump())}>{`${label}: ${s} / ${l}`}</button>
}

// App-scope entries: shared by every Island of this registry on the page.
export const Island = defineIslands({ counter: async () => ({ default: Counter }) }, { provide: [SharedLayer] })

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
