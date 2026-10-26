import { Context, Effect } from 'effect'

export class Clock extends Context.Tag('app/Clock')<Clock, { readonly now: () => number }>() {}

/** The `Effect.Service` form: the constructor yields each dependency and returns the methods. */
export class Greeter extends Effect.Service<Greeter>()('app/Greeter', {
  effect: Effect.gen(function* () {
    const clock = yield* Clock
    const greet = (name: string) => Effect.succeed(`Hello ${name} at ${clock.now()}`)
    return {
      greet,
      greetAll: (names: ReadonlyArray<string>) => Effect.forEach(names, greet),
    }
  }),
}) {}
