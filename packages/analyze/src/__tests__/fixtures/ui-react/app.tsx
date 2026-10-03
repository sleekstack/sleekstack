import { Effect, Layer } from 'effect'
import { el, fromReact, mount } from '@sleekstack/ui'

const Badge = () => Effect.succeed(el('span', {}, 'badge'))

const Frame = fromReact((p: { title: string; slot?: unknown }) => p.title)
const Shell = fromReact(() => <div><Badge /></div>) // @error EffectInsideReact

const App = () =>
  Effect.gen(function* () {
    const frame = yield* Frame({ title: 't', slot: Badge }) // @error EffectInsideReact
    const shell = yield* Shell({})
    return el('main', {}, frame, shell)
  })

export const run = (c: Element) => mount(App(), { layer: Layer.empty, container: c })
