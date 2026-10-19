import { Context, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'
declare const name: string
const Dynamic = Context.GenericTag<object>(name)
class Clock extends Context.Tag('Clock')<Clock, object>() {}
const makeLayers = (): any[] => [declareLayer(Layer.succeed(Clock, {}))]

export const App = module({
  name: 'App',
  entries: makeLayers(),
  exports: [Dynamic],
})

declare function register(xs: unknown[]): void
const escaped = [declareLayer(Layer.succeed(Clock, {}))]
register(escaped)
let swapped = [declareLayer(Layer.succeed(Clock, {}))]
swapped = []

export const Escaped = module({ name: 'Escaped', entries: escaped })
export const Rebound = module({ name: 'Rebound', entries: swapped })
