import { effect, layer, module, tag } from '@sleekstack/kit'

interface Logger {
  log(msg: string): void
}
const Logger = tag<Logger>('Logger')

// Runs when the app scope opens; the returned function runs when it closes.
const Heartbeat = effect(
  (logger) => {
    const id = setInterval(() => logger.log('tick'), 1000)
    return () => clearInterval(id)
  },
  [Logger],
  { name: 'heartbeat' },
)

// Per request: one effect per request scope.
const RequestLog = effect(
  (logger) => {
    logger.log('request opened')
    return () => logger.log('request closed')
  },
  [Logger],
  { name: 'request-log', lifetime: 'request' },
)

export const App = module({ name: 'app', provide: [layer(Logger, { log: console.log }), Heartbeat, RequestLog] })
