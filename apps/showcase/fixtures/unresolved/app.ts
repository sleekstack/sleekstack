// Unresolved: a dynamically picked component cannot be read, so the check fails closed.
import { Effect, Layer } from 'effect'
import { el, mount, type Component } from '@sleekstack/ui'

declare const pick: () => Component<{}, never, never>
const C = pick()

const App = () =>
  Effect.gen(function* () {
    const picked = yield* C({}) // @error Unresolved
    return el('main', {}, picked)
  })

export const run = (container: Element) => mount(App(), { layer: Layer.empty, container })
