import { Context, Effect, Layer } from 'effect'
import { declareLayer, module } from '@sleekstack/core'

class Logger extends Context.Tag('Logger')<Logger, { log(msg: string): void }>() {}

// Runs when the app scope opens; the release runs when it closes. It provides no service.
const Heartbeat = declareLayer(
  Layer.scopedDiscard(
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* Effect.acquireRelease(
        Effect.sync(() => setInterval(() => logger.log('tick'), 1000)),
        (id) => Effect.sync(() => clearInterval(id)),
      )
    }),
  ),
)

// Per request: one effect per request scope.
const RequestLog = declareLayer(
  Layer.scopedDiscard(
    Effect.gen(function* () {
      const logger = yield* Logger
      yield* Effect.acquireRelease(
        Effect.sync(() => logger.log('request opened')),
        () => Effect.sync(() => logger.log('request closed')),
      )
    }),
  ),
  { lifetime: 'request' },
)

export const App = module({
  name: 'app',
  entries: [declareLayer(Layer.succeed(Logger, { log: console.log })), Heartbeat, RequestLog],
})
