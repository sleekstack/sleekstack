import { Effect } from 'effect'

/** The HTTP methods in canonical (`Allow`) order. */
export const methods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const

/** An HTTP method a route handler can answer. */
export type Method = (typeof methods)[number]

/** A route handler: one Effect per HTTP method, each answering the request with a `Response`. */
export type Handler<E = any, R = any> = {
  readonly [M in Method]?: (request: Request) => Effect.Effect<Response, E, R>
}

/** The method's Effect, or a 405 naming the methods the handler has in `Allow`. */
export const runHandler = <E, R>(handler: Handler<E, R>, request: Request): Effect.Effect<Response, E, R> => {
  const method = request.method.toUpperCase() as Method
  if (methods.includes(method) && typeof handler[method] === 'function') return handler[method](request)
  const allow = methods.filter((m) => typeof handler[m] === 'function').join(', ')
  return Effect.succeed(new Response(null, { status: 405, headers: { allow } }))
}
