import { Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'

// `Effect.Tag` classes (static accessors) are Tags just like `Context.Tag` classes.
class Clock extends Effect.Tag('Clock')<Clock, { now(): number }>() {}
class Logger extends Effect.Tag('Logger')<Logger, { log(): void }>() {}

const ClockDef = declareLayer(Layer.succeed(Clock, { now: () => 0 }))
const LoggerDef = declareLayer(Layer.effect(Logger, Effect.as(Clock.now(), { log: () => {} })))

export const App = module({ name: 'App', entries: [ClockDef, LoggerDef] })
