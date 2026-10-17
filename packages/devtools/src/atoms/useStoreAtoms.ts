/**
 * packages/devtools/src/atoms/useStoreAtoms.ts
 *
 * Lists the built atoms of every open store a `uiTrace` observed, re-read every poll. A store is open while a mount it
 * was given still has live instances; one disposed or failing mid-poll is skipped, never thrown on.
 */
import type { Atom, AtomStore } from '@sleekstack/core'
import { type Store, useEffect, useLocal } from '@sleekstack/ui'
import { Effect } from 'effect'
import type { UiTrace } from '../ui/uiPanel'

type Snapshot = readonly {
  readonly store: AtomStore
  readonly atoms: readonly { readonly atom: Atom.Atom<unknown>; readonly label: string; readonly value: unknown }[]
}[]

const read = (trace: UiTrace | undefined): Snapshot => {
  if (!trace) return []
  const { stores, instances } = trace.read()
  const open = new Set([...stores].filter(([mount]) => instances.some((i) => i.mount === mount)).map(([, s]) => s))
  return [...open].flatMap((store) => {
    try {
      return [{ store, atoms: [...store.inspect()] }]
    } catch {
      return []
    }
  })
}

/** Built atoms of every open store `trace` observed, re-read every `intervalMs`; one entry per store. */
export const useStoreAtoms = (trace: UiTrace | undefined, intervalMs: number): Effect.Effect<Snapshot, never, Store> =>
  Effect.gen(function* () {
    // Each tick re-runs the caller, which re-reads the stores.
    const [, setTick] = yield* useLocal(0)
    yield* useEffect(() => {
      if (!trace) return
      const timer = setInterval(() => setTick((n) => n + 1), intervalMs)
      return () => clearInterval(timer)
    }, [trace, intervalMs])
    return read(trace)
  })
