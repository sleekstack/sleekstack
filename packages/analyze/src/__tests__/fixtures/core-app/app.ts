import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'

class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
class Logger extends Context.Tag('Logger')<Logger, { log(): void }>() {}
class Store extends Context.Tag('Store')<Store, object>() {}
class Activity extends Context.Tag('ActivityLog')<Activity, object>() {}

const ClockDef = declareLayer(Layer.succeed(Clock, { now: () => 0 } as never))
const LoggerDef = declareLayer(Layer.effect(Logger, Effect.as(Clock, { log: () => {} })))
const Startup = Layer.succeed(Context.GenericTag<string>('Raw'), 'r')

export const Infra = module({ name: 'Infra', entries: [ClockDef, LoggerDef, Startup], exports: [Clock, Logger] })
export const Data = module({
  name: 'Data',
  imports: [Infra],
  lifetime: 'request',
  entries: [declareLayer(Layer.effect(Store, Effect.as(Logger, {} as never)), { lifetime: 'app' })],
  exports: [],
})
export const App = module({
  name: 'App',
  imports: () => [Data, Infra],
  entries: [declareLayer(Layer.effect(Activity, Effect.as(Clock, {}))), ClockDef],
})
