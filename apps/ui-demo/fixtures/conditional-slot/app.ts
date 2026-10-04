// ConditionalSlot: a useLocal call behind a branch would shift every later slot.
import { Effect, Layer } from 'effect'
import { el, mount, useLocal } from '@sleekstack/ui'

const App = (flag: boolean) =>
  Effect.gen(function* () {
    if (flag) yield* useLocal(0) // @error ConditionalSlot
    return el('main')
  })

export const run = (container: Element) => mount(App(true), { layer: Layer.empty, container })
