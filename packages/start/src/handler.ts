import { Effect } from 'effect'

export type Method = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

/** A route handler: one Effect per HTTP method, each answering the request with a `Response`. */
export type Handler<E = any, R = any> = {
  readonly [M in Method]?: (request: Request) => Effect.Effect<Response, E, R>
}

/** The method's Effect, or a 405 naming the methods the handler has in `Allow`. */
export const runHandler = <E, R>(handler: Handler<E, R>, request: Request): Effect.Effect<Response, E, R> => {
  const run = handler[request.method.toUpperCase() as Method]
  if (run) return run(request)
  const allow = Object.keys(handler).join(', ')
  return Effect.succeed(new Response(null, { status: 405, headers: { allow } }))
}
