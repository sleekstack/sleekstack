/** @jsxImportSource @sleekstack/ui */
import { Atom } from '@sleekstack/core'
import { hydrateMount, useAtom } from '@sleekstack/ui'
import { Effect, Layer, Schema } from 'effect'

const countAtom = Atom.serializable(Atom.make(0), { key: 'count', schema: Schema.Number })

const Counter = () =>
  Effect.gen(function* () {
    const [count, set] = yield* useAtom(countAtom)
    return yield* (<button onClick={() => Effect.sync(() => set(count + 1))}>{String(count)}</button>)
  })

/** Size budget entry (ADR 0022): a reactive app hydrating server HTML. */
export const hydrateCounter = (container: Element) => hydrateMount(<Counter />, { layer: Layer.empty, container })
