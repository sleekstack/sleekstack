/** @jsxImportSource @sleekstack/ui */
import { Atom } from '@sleekstack/core'
import { Effect } from 'effect'
import { useAtom, useAtomValue, useDerivedAtom, useEffect, useLocal, useRef } from '@sleekstack/ui'

class Prices extends Effect.Tag('Prices')<Prices, { price(item: string): Effect.Effect<number> }>() {}

// A module-level atom: its state lives in the Store of each mount.
const itemAtom = Atom.make('apple')

export const Cart = function* () {
  // Slot hooks: top-level `yield*` statements, before any return, in the same order on every run.
  const [count, setCount] = yield* useLocal(1)
  const input = yield* useRef<HTMLInputElement>()
  // One derived atom for the instance's life, run in the component's context: it can yield `Prices`.
  const price = yield* useDerivedAtom(function* (get) {
    return yield* Prices.price(get(itemAtom))
  })
  // Runs once, after the first commit: the input is attached by then.
  yield* useEffect(() => input.current?.focus(), [])
  // A generator effect restarts when an atom it reads changes; its finalizers are the cleanup.
  yield* useEffect(function* () {
    const item = yield* useAtomValue(itemAtom)
    yield* Effect.addFinalizer(() => Effect.log(`left ${item}`))
  })

  // Atom reads are not slots: the component re-runs when one of them changes.
  const [item, setItem] = yield* useAtom(itemAtom)
  const total = yield* useAtomValue(price)
  return (
    <p>
      <input ref={input} value={item} onInput={(e) => setItem(e.currentTarget.value)} />
      <button type="button" onClick={() => setCount((n) => n + 1)}>
        {count}
      </button>
      <output>{total._tag === 'Success' ? total.value * count : '...'}</output>
    </p>
  )
}
