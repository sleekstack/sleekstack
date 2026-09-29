import { Context, Effect, Layer } from 'effect'
import { declareLayer, module, service } from '@sleekstack/core'

class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
const Logger = Context.GenericTag<{ log(): void }>('Logger')
const Store = Context.GenericTag<object>('Store')
const Activity = Context.GenericTag<object>('ActivityLog')

const ClockDef = service(Clock, {}, () => Effect.succeed({ now: () => 0 }))
const LoggerDef = service(Logger, { requires: [Clock] }, () => Effect.succeed({ log: () => {} }))
const Startup = Layer.succeed(Context.GenericTag<string>('Raw'), 'r')

export const Infra = module({ name: 'Infra', entries: [ClockDef, LoggerDef, Startup], exports: [Clock, Logger] })
export const Data = module({
  name: 'Data',
  imports: [Infra],
  lifetime: 'request',
  entries: [service(Store, { requires: [Logger], lifetime: 'app' }, () => Effect.succeed({}))],
  exports: [],
})
export const App = module({
  name: 'App',
  imports: () => [Data, Infra],
  entries: [declareLayer(Layer.succeed(Activity, {}), { provides: [Activity], requires: [Clock] }), ClockDef],
})
