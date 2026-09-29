'use client'
import { useEffect, useSyncExternalStore } from 'react'
import { useService } from '@sleekstack/kit/react'
import { ISLAND_MARKER } from './marker'
import { LocalTally, SharedTally, type Tally } from './services'

const useTally = (t: Tally) => useSyncExternalStore(t.subscribe, t.get, t.get)

/** Reads an app-scope service (shared across Islands) and a component-scope one (its own). */
export default function Shared({ id }: { readonly id: string }) {
  const shared = useService(SharedTally)
  const local = useService(LocalTally)
  const s = useTally(shared)
  const l = useTally(local)
  useEffect(() => {
    const w = window as { __hydrated?: Record<string, boolean> }
    ;(w.__hydrated ??= {})[id] = true
  }, [id])
  return (
    <div data-marker={ISLAND_MARKER}>
      <button type="button" onClick={() => shared.bump()}>{`shared ${s}`}</button>
      <button type="button" onClick={() => local.bump()}>{`local ${l}`}</button>
    </div>
  )
}
