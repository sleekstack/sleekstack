import { Context, Effect } from 'effect'
import { makeAppScope, module, service } from '@sleekstack/core'

export class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
export class Greeter extends Context.Tag('Greeter')<Greeter, { greet(name: string): string }>() {}

const ClockLive = service(Clock, {}, () => Effect.succeed({ now: () => Date.now() }))
// `requires` drives both the resolved tuple and the Layer's requirement type.
const GreeterLive = service(Greeter, { requires: [Clock] }, ([clock]) =>
  Effect.succeed({ greet: (name: string) => `Hello ${name} at ${clock.now()}` }))

export const AppModule = module({ name: 'app', entries: [ClockLive, GreeterLive] })

// `sleekstack check` validates the graph at build time; the runtime just resolves it.
Effect.runPromise(makeAppScope([AppModule])).then((app) => console.log(Context.get(app.context, Greeter).greet('Ada')))
