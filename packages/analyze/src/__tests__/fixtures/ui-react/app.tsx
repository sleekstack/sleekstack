import { Effect, Layer } from 'effect'
import type { ComponentType } from 'react'
import { el, fromReact, mount } from '@sleekstack/ui'

declare const Vendor: ComponentType<{}>

const Badge = () => Effect.succeed(el('span', {}, 'badge'))

const Frame = fromReact((p: { title: string; slot?: unknown }) => p.title)
const Shell = fromReact(() => <div><Badge /></div>) // @error EffectInsideReact
const Opaque = fromReact(Vendor) // @error Unresolved

const App = () =>
  Effect.gen(function* () {
    const frame = yield* Frame({ title: 't', slot: Badge }) // @error EffectInsideReact
    const nested = yield* Frame({ title: 'n', slot: { items: [Badge] } }) // @error EffectInsideReact
    const spread = yield* Frame({ title: 's', ...{ slot: Badge } }) // @error EffectInsideReact
    const shell = yield* Shell({})
    const opaque = yield* Opaque({})
    return el('main', {}, frame, nested, spread, shell, opaque)
  })

export const run = (c: Element) => mount(App(), { layer: Layer.empty, container: c })
