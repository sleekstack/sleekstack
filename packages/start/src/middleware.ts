import { Effect } from 'effect'

/** Runs before everything else: a `Response` answers the request and skips the rest; nothing continues. */
export type Middleware<E = any, R = any> = (request: Request) => Effect.Effect<Response | void, E, R>

/** The first `Response` a middleware returns, in order, or `undefined` when all continue. */
export const runMiddleware = <E, R>(
  middleware: ReadonlyArray<Middleware<E, R>>,
  request: Request,
): Effect.Effect<Response | undefined, E, R> =>
  Effect.gen(function* () {
    for (const m of middleware) {
      const response = yield* m(request)
      if (response) return response
    }
    return undefined
  })
