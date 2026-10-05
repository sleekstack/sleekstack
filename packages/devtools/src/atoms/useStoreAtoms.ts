/**
 * packages/devtools/src/atoms/useStoreAtoms.ts
 *
 * Polls the dev-only atom store registry (`@sleekstack/react/internal`) client-side and lists every open
 * `LayerProvider` store's built atoms. A store disposed or failing mid-poll is skipped, never thrown on.
 */
import { useEffect, useState } from 'react'
import type { Atom, AtomStore } from '@sleekstack/core'
import { atomStores } from '@sleekstack/react/internal'

type Snapshot = readonly {
  readonly store: AtomStore
  readonly atoms: readonly { readonly atom: Atom.Atom<unknown>; readonly label: string; readonly value: unknown }[]
}[]

const read = (): Snapshot =>
  atomStores().flatMap((store) => {
    try {
      return [{ store, atoms: [...store.inspect()] }]
    } catch {
      return []
    }
  })

/** Built atoms of every registered store, re-read every `intervalMs`; one entry per store. */
export function useStoreAtoms(intervalMs: number): Snapshot {
  const [stores, setStores] = useState<Snapshot>(read)
  useEffect(() => {
    const timer = setInterval(() => setStores(read()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return stores
}
