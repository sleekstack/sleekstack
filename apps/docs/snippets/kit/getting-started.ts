import { layer, module, tag } from '@sleekstack/kit'

interface Clock {
  now(): number
}
interface Greeter {
  greet(name: string): string
}

export const Clock = tag<Clock>('Clock')
export const Greeter = tag<Greeter>('Greeter')

// A value, and a factory that receives its deps in order.
const ClockLive = layer(Clock, { now: () => Date.now() })
const GreeterLive = layer(Greeter, (clock) => ({ greet: (name) => `Hello ${name} at ${clock.now()}` }), [Clock])

export const AppModule = module({ name: 'app', provide: [ClockLive, GreeterLive] })

// `sleekstack check` validates the whole graph at build time, without running anything.
