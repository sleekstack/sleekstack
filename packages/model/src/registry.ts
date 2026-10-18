import { Atom, type AtomStore } from '@sleekstack/core'
import { Option } from 'effect'

/** One record's state in a Store: its value, and the time of its last acknowledged save. */
export interface Slot<A> {
  readonly value: Option.Option<A>
  readonly ackedAt: Option.Option<number>
}

export const EMPTY: Slot<never> = { value: Option.none(), ackedAt: Option.none() }

type Slots = Map<string, Atom.Writable<Slot<unknown>>>

// One map per Store, from `[type, id]` to that record's slot. Kept alive, so a record nobody reads stays until the
// Store is disposed; every slot is kept alive too, and `evict` empties a slot instead of removing it, so a type and id
// keep one slot atom for the Store's life.
const registry = Atom.keepAlive(Atom.make((): Slots => new Map()))

const keyOf = (type: string, id: string) => JSON.stringify([type, id])

const slotIn = (slots: Slots, key: string) => {
  let slot = slots.get(key)
  if (!slot) slots.set(key, (slot = Atom.keepAlive(Atom.make<Slot<unknown>>(EMPTY))))
  return slot
}

/** The slot atom of `type` and `id` in `store`, made on first use. */
export const slotOf = (store: AtomStore, type: string, id: string): Atom.Writable<Slot<unknown>> =>
  slotIn(store.get(registry), keyOf(type, id))

// The reader holds no state, so `family` may reclaim one nobody references: a new reader reads the same slot.
const valueAtom = Atom.family((key: string): Atom.Atom<Option.Option<unknown>> =>
  // `Atom.make` would run an `Option` as an Effect; `writable` returns it as the value. Typed read-only.
  Atom.writable<Option.Option<unknown>, never>(
    (get) => get(slotIn(get(registry), key)).value,
    () => {},
  ),
)

/** The record of `type` and `id` in the reading Store: one atom for a type and id, whichever definition asks. */
export const recordAtom = (type: string, id: string): Atom.Atom<Option.Option<unknown>> => valueAtom(keyOf(type, id))
