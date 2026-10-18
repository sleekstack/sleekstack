import { Atom, type AtomStore } from '@sleekstack/core'
import { Option } from 'effect'

/** One record's state in a Store: its value, and the time of its last acknowledged save. */
export interface Slot<A> {
  readonly value: Option.Option<A>
  readonly ackedAt: Option.Option<number>
}

export const EMPTY: Slot<never> = { value: Option.none(), ackedAt: Option.none() }

// One map per Store, from `[type, id]` to that record's slot. Kept alive, so a record nobody reads stays until the
// Store is disposed; every slot is kept alive too, and `evict` empties a slot instead of removing it, so a type and id
// keep one atom for the Store's life.
const registry = Atom.keepAlive(Atom.make(() => new Map<string, Atom.Writable<Slot<unknown>>>()))

const slotIn = (slots: Map<string, Atom.Writable<Slot<unknown>>>, type: string, id: string) => {
  const key = JSON.stringify([type, id])
  let slot = slots.get(key)
  if (!slot) slots.set(key, (slot = Atom.keepAlive(Atom.make<Slot<unknown>>(EMPTY))))
  return slot
}

/** The slot atom of `type` and `id` in `store`, made on first use. */
export const slotOf = (store: AtomStore, type: string, id: string): Atom.Writable<Slot<unknown>> =>
  slotIn(store.get(registry), type, id)

/** Reads the slot of `type` and `id` from inside an atom's read, in whatever Store builds it. */
export const readSlot = (get: Atom.Context, type: string, id: string): Slot<unknown> =>
  get(slotIn(get(registry), type, id))
