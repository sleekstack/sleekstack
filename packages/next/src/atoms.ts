/**
 * packages/next/src/atoms.ts
 *
 * Server-component prefetch for serializable atoms: builds a store on the request-scoped runtime,
 * waits for every listed result atom to leave `Initial`, and returns its `Snapshot` for a client
 * `<LayerProvider hydrate>`. The store is disposed before the promise settles.
 */

import { Effect } from 'effect'
import { Atom, dehydrate, makeAtomStore, type AtomStore, type Snapshot } from '@sleekstack/core'
import type { RunEffectOptions } from '@sleekstack/runtime'
import { runEffect } from './runtime'

const settled = (store: AtomStore, atom: Atom.Atom<any>): Promise<void> =>
  new Promise((resolve) => {
    const done = () => { const v = store.get(atom); return atom.serializable?.kind !== 'result' || v._tag !== 'Initial' } // `get` rethrows a failed read
    if (done()) return resolve()
    const unsubscribe = store.subscribe(atom, () => { if (done()) { unsubscribe(); resolve() } })
  })

/**
 * Reads `atoms` on the configured runtime and dehydrates them. A result atom that settles to
 * `Failure` is left out (the client loads it).
 *
 * @param atoms - Serializable atoms (see `Atom.serializable`).
 * @param options - Per-call `request` / `overrides` Layers.
 * @returns A promise of the `Snapshot` (a plain object, safe as a client-component prop).
 * @throws Rejects like `runEffect` (e.g. `RuntimeNotConfigured`, a failing request Layer).
 *
 * @example
 * ```ts
 * const snapshot = await prefetchAtoms([greeting])
 * return <Client snapshot={snapshot} />
 * ```
 */
export const prefetchAtoms = (
  atoms: ReadonlyArray<Atom.Serializable<Atom.Atom<any>>>,
  options: RunEffectOptions = {},
): Promise<Snapshot> =>
  runEffect(
    Effect.flatMap(Effect.context<any>(), (context) =>
      Effect.acquireUseRelease(
        Effect.sync(() => makeAtomStore({ context })),
        (store) =>
          Effect.sync(() => { for (const a of atoms) store.mount(a) }).pipe(
            Effect.zipRight(Effect.promise(() => Promise.all(atoms.map((a) => settled(store, a))))),
            Effect.map(() => ({ ...dehydrate(store) })), // RSC props reject null-prototype objects
          ),
        (store) => Effect.promise(() => store.dispose()),
      ),
    ),
    options,
  )
