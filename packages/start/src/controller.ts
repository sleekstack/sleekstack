import { bind, segments } from '@sleekstack/router'
import { Data, Effect } from 'effect'
import type { ControllerEntry } from './app'
import { type Method, methods } from './handler'

/**
 * A path segment with a malformed percent-escape bound to a Controller's `:param`, `:param?` or `*splat`. It reaches
 * `wrap`; unhandled, it answers 404 with no body. In a static position the segment matches no Controller instead.
 */
export class InvalidPathEncoding extends Data.TaggedError('InvalidPathEncoding')<{}> {}

/**
 * A method the matched Controller does not serve, with the methods it does in `Allow` order, the implicit `HEAD` and
 * `OPTIONS` included. It reaches `wrap`; unhandled, it answers 405 with `Allow`.
 */
export class MethodNotAllowed extends Data.TaggedError('MethodNotAllowed')<{
  readonly allowed: ReadonlyArray<Method>
}> {}

/** A request body over the Controller's `bodyLimit`. It reaches `wrap`; unhandled, it answers 413. */
export class BodyTooLarge extends Data.TaggedError('BodyTooLarge')<{}> {}

/**
 * A request to a method that declares `body` without `Content-Type: application/json`. It reaches `wrap`; unhandled,
 * it answers 415.
 */
export class UnsupportedMediaType extends Data.TaggedError('UnsupportedMediaType')<{}> {}

// A lone surrogate: no successful decode yields one, so it marks a malformed escape. A static segment never equals it.
const MALFORMED = '\uD800'

const decode = (segment: string) => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return MALFORMED
  }
}

/** A Controller matched to a pathname, with the path's params. */
export interface ControllerMatch {
  readonly entry: ControllerEntry
  readonly params: Readonly<Record<string, string>>
}

/**
 * The first Controller in list order whose pattern matches `pathname`, by the page matcher's rules but one: a
 * segment with a malformed escape binds at a `:param`, `:param?` or `*splat` position, and serving it fails with
 * `InvalidPathEncoding`.
 */
export const matchController = (
  controllers: ReadonlyArray<ControllerEntry>,
  pathname: string,
): ControllerMatch | undefined => {
  const actual = segments(pathname).map(decode)
  for (const entry of controllers) {
    const params = bind(segments(entry.pattern), actual)
    if (params) return { entry, params }
  }
  return undefined
}

/** The answer to a routing failure that no `wrap` handled; any other failure stays one. */
const unhandled = (e: unknown): Effect.Effect<Response, unknown> => {
  if (e instanceof InvalidPathEncoding) return Effect.succeed(new Response(null, { status: 404 }))
  if (e instanceof MethodNotAllowed)
    return Effect.succeed(new Response(null, { status: 405, headers: { allow: e.allowed.join(', ') } }))
  if (e instanceof BodyTooLarge) return Effect.succeed(new Response(null, { status: 413 }))
  if (e instanceof UnsupportedMediaType) return Effect.succeed(new Response(null, { status: 415 }))
  return Effect.fail(e)
}

/** A `HEAD` answer: `response` without its body, a streaming one cancelled. */
const withoutBody = (response: Response) => {
  response.body?.cancel().catch(() => {})
  return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers })
}

/**
 * A matched Controller's answer. Inside the `wrap` chain (outermost first): the method (`HEAD` runs `GET` unless
 * exported, `OPTIONS` answers 204 with `Allow` unless exported, else `MethodNotAllowed`), the path's escapes
 * (`InvalidPathEncoding`), then the method, its value answered as JSON at the `ResponseStatus` status. Outside it:
 * the routing failures `wrap` left unhandled, then a `HEAD` answer's body dropped.
 */
export const serveController = (
  { entry, params }: ControllerMatch,
  request: Request,
  status: () => number | undefined,
): Effect.Effect<Response, unknown, unknown> => {
  const method = request.method.toUpperCase()
  const allowed = methods.filter((m) => entry.methods[m] || m === 'OPTIONS' || (m === 'HEAD' && entry.methods.GET))
  const face = Effect.gen(function* () {
    const served = (method === 'HEAD' && !entry.methods.HEAD ? 'GET' : method) as Method
    const run = methods.includes(served) ? entry.methods[served] : undefined
    if (!run) {
      if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: allowed.join(', ') } })
      return yield* new MethodNotAllowed({ allowed })
    }
    if (Object.values(params).some((v) => v.includes(MALFORMED))) return yield* new InvalidPathEncoding()
    const value = yield* run.run({ params })
    return value instanceof Response ? value : Response.json(value, { status: status() ?? 200 })
  })
  const wrapped = entry.options.reduceRight<Effect.Effect<Response, unknown, unknown>>(
    (next, options) => (options.wrap ? options.wrap(next, request) : next),
    face,
  )
  const answer = Effect.catchAll(wrapped, unhandled)
  return method === 'HEAD' ? Effect.map(answer, withoutBody) : answer
}
