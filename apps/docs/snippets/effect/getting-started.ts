import { Context, Effect, Layer } from 'effect'
import { declareLayer, makeAppScope, module } from '@sleekstack/core'

export class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
export class Greeter extends Context.Tag('Greeter')<Greeter, { greet(name: string): string }>() {}

const ClockLive = declareLayer(Layer.succeed(Clock, { now: () => Date.now() }))
// The Layer is plain Effect: `sleekstack check` reads what it provides and requires from its type.
const GreeterLive = declareLayer(
  Layer.effect(Greeter, Effect.map(Clock, (clock) => ({ greet: (name: string) => `Hello ${name} at ${clock.now()}` }))),
)

export const AppModule = module({ name: 'app', entries: [ClockLive, GreeterLive] })

// `sleekstack check` validates the graph at build time; the runtime just resolves it.
Effect.runPromise(makeAppScope([AppModule])).then((app) => console.log(Context.get(app.context, Greeter).greet('Ada')))
