import { Effect, Layer } from 'effect'
import { el, mount, type Component, type Node } from '@sleekstack/ui'

declare const untyped: any
declare const External: Component<{}, never, never>
declare const pick: () => Component<{}, never, never>

const Ok = () => Effect.succeed(el('p'))
const C = pick()

const App = () =>
  Effect.gen(function* () {
    const a = yield* untyped // @error Unresolved
    const b = yield* C({}) // @error Unresolved
    const d = yield* External({}) // @error Unresolved
    const e = yield* Ok()
    return el('main', {}, a as Node, b, d, e)
  })

export const run = (c: Element) => mount(App(), { layer: Layer.empty, container: c }) // @error Unresolved
