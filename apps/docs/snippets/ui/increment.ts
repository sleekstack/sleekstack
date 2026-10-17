import { Atom } from '@sleekstack/core'
import { Effect, Schema } from 'effect'
import { defineHandler, Store } from '@sleekstack/ui'

// Serializable: the server manifest carries its value, so `resume` seeds it without running a component.
export const countAtom = Atom.serializable(Atom.make(0), { key: 'count', schema: Schema.Number })

// The handler's own module, loaded on the first click. The id is a literal; the server emits only the id.
export default defineHandler('increment', () =>
  Effect.flatMap(Store, (store) => Effect.sync(() => store.update(countAtom, (n) => n + 1))),
)
