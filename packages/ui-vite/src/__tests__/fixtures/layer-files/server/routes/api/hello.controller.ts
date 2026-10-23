import { Effect } from 'effect'
import { Config, Greeter } from '../../../src/tags'

export const GET = (): Effect.Effect<string, never, Config | Greeter> =>
  Effect.gen(function* () {
    const config = yield* Config
    const greeter = yield* Greeter
    return `${config.greeting} / ${greeter.greet('ann')}`
  })
