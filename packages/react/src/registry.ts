/**
 * packages/react/src/registry.ts — @sleekstack/react/internal
 *
 * Dev-only atom store registry read by the devtools panel. `LayerProvider` (via managedScope) appends each
 * provider's store to a fixed `globalThis` list outside production and removes it on close, so this module
 * only reads: stores created before it loaded are still listed.
 */
import { useContext } from 'react'
import type { AtomStore } from '@sleekstack/core'
import { ProviderContext } from './context'

/** @internal The `globalThis` key managedScope writes; stores live there while their provider is open. */
export const STORES_KEY = '__sleekstack_atom_stores__'

/** @internal Atom stores of every open `LayerProvider` (always empty in production builds). */
export const atomStores = (): readonly AtomStore[] => [...((globalThis as Record<string, unknown>)[STORES_KEY] as Set<AtomStore> | undefined ?? [])]

/** @internal The atom store of the nearest `LayerProvider` (where `useAtomValue` reads), once its scope opened. */
export const useProviderAtomStore = (): AtomStore | undefined => useContext(ProviderContext)?.atoms
