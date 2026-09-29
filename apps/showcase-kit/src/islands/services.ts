import { layer, tag } from '@sleekstack/kit'

/** A tiny `useSyncExternalStore` store. */
export interface Tally {
  get(): number
  bump(): void
  subscribe(listener: () => void): () => void
}

const makeTally = (): Tally => {
  let n = 0
  const listeners = new Set<() => void>()
  return {
    get: () => n,
    bump: () => {
      n++
      listeners.forEach((l) => l())
    },
    subscribe: (l) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
  }
}

/** App scope: one instance shared by every Island on the page. */
export const SharedTally = tag<Tally>('IslandsSharedTally')
export const SharedTallyLayer = layer(SharedTally, makeTally)

/** Component scope: one instance per Island. */
export const LocalTally = tag<Tally>('IslandsLocalTally')
export const LocalTallyLayer = layer(LocalTally, makeTally, [], { lifetime: 'component' })
