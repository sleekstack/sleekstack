import { Atom } from '@sleekstack/core'
import { Context, Data, Effect, Layer } from 'effect'
import { el, mount, useAtomValue } from '@sleekstack/ui'

class Clock extends Context.Tag('Clock')<Clock, number>() {}
class Store extends Context.Tag('Store')<Store, string>() {}
class Denied extends Data.TaggedError('Denied')<{}> {}

const count = Atom.make(0)

const Counter = () => Effect.map(useAtomValue(count), (n) => el('b', {}, String(n)))
const Timed = () => Effect.zipWith(useAtomValue(count), Clock, (n, t) => el('i', {}, String(n + t)))
const Guarded = () =>
  Effect.gen(function* () {
    if ((yield* useAtomValue(count)) > 0) return yield* Effect.fail(new Denied())
    return el('p')
  })

export const clean = (c: Element) => mount(Counter(), { layer: Layer.empty, container: c })
export const missing = (c: Element) => mount(Timed(), { layer: Layer.empty, container: c }) // @error MissingDependency
export const unhandled = (c: Element) => mount(Guarded(), { layer: Layer.empty, container: c }) // @error UnhandledError
export const sameName = (c: Element) => mount(Effect.map(Store, (s) => el('i', {}, s)), { layer: Layer.empty, container: c }) // @error MissingDependency
