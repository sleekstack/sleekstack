import { bind, segments } from '@sleekstack/router'
import { Data, Effect, ParseResult, Schema, SchemaAST } from 'effect'
import type { ControllerEntry, ControllerMethodEntry } from './app'
import { type Method, methods } from './handler'
import { DecodeError, decodeError, readBody } from './wire'

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

type AnySchema = Schema.Schema<any, any, never>

const parts = ['params', 'query', 'body'] as const

const isArray = (ast: SchemaAST.AST): boolean =>
  SchemaAST.isTupleType(ast) || (SchemaAST.isUnion(ast) && ast.types.some(isArray))

/** The URL's query for `schema`: a repeated key gives all its values when its encoded type is an array, else the last. */
const queryOf = (url: URL, schema: AnySchema) => {
  const ast = SchemaAST.encodedAST(schema.ast)
  const arrays = new Set(
    SchemaAST.isTypeLiteral(ast) ? ast.propertySignatures.filter((p) => isArray(p.type)).map((p) => p.name) : [],
  )
  const query: Record<string, string | string[]> = Object.create(null)
  for (const [key, value] of url.searchParams) query[key] = arrays.has(key) ? [...(query[key] ?? []), value] : value
  return query
}

const isJson = (contentType: string | null) => contentType?.split(';')[0].trim().toLowerCase() === 'application/json'

const notJson = (text: string) =>
  new ParseResult.ParseError({
    issue: new ParseResult.Pointer('body', text, new ParseResult.Type(Schema.Unknown.ast, text, 'is not valid JSON')),
  })

/** The JSON body, checked in order: content type, size within `limit`, JSON. An empty body is `undefined`. */
const readJson = (request: Request, limit: number) =>
  Effect.gen(function* () {
    if (!isJson(request.headers.get('content-type'))) return yield* new UnsupportedMediaType()
    const text = yield* Effect.promise(() => readBody(request, limit))
    if (text === undefined) return yield* new BodyTooLarge()
    if (text === '') return undefined
    return yield* Effect.try({ try: (): unknown => JSON.parse(text), catch: () => notJson(text) })
  })

/** The method's declared input parts decoded together, every issue reported with its path from the input object. */
const decodeInput = (
  method: ControllerMethodEntry,
  request: Request,
  { params, limit }: { readonly params: Readonly<Record<string, string>>; readonly limit: number },
) =>
  Effect.gen(function* () {
    const raw: Record<string, unknown> = {}
    if (method.params) raw.params = params
    if (method.query) raw.query = queryOf(new URL(request.url), method.query)
    if (method.body) {
      const body = yield* readJson(request, limit)
      if (body !== undefined) raw.body = body
    }
    const fields = Object.fromEntries(parts.flatMap((part) => (method[part] ? [[part, method[part]]] : [])))
    return yield* Schema.decodeUnknown(Schema.Struct(fields), { errors: 'all' })(raw)
  })

// Statuses whose answer has no body.
const NULL_BODY = new Set([204, 205, 304])

/**
 * The method's value as the answer: a `Response` as it is; else at the `ResponseStatus` status (default 200, or 204
 * for `undefined`), encoded through `success` when written, with no body for `undefined` or a null-body status.
 */
const encode = (method: ControllerMethodEntry, value: unknown, set: number | undefined) =>
  Effect.gen(function* () {
    if (value instanceof Response) return value
    const status = set ?? (value === undefined ? 204 : 200)
    const body = method.success ? yield* Effect.orDie(Schema.encode(method.success)(value)) : value
    return body === undefined || NULL_BODY.has(status)
      ? new Response(null, { status })
      : Response.json(body, { status })
  })

/** The answer to a routing or decode failure that no `wrap` handled; any other failure stays one. */
const unhandled = (e: unknown): Effect.Effect<Response, unknown> => {
  if (ParseResult.isParseError(e))
    return Effect.succeed(Response.json(Schema.encodeSync(DecodeError)(decodeError(e)), { status: 400 }))
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

/** What `start` gives every Controller: the request's `ResponseStatus` and the app-wide `bodyLimit`. */
export interface ServeDefaults {
  readonly status: () => number | undefined
  readonly bodyLimit: number
}

/**
 * A matched Controller's answer. Inside the `wrap` chain (outermost first): the method (`HEAD` runs `GET` unless
 * exported, `OPTIONS` answers 204 with `Allow` unless exported, else `MethodNotAllowed`), the path's escapes
 * (`InvalidPathEncoding`), the input (content type, body size within the most specific `bodyLimit`, JSON, then the
 * decode), the method, then its value encoded. Outside it: the routing and decode failures `wrap` left unhandled,
 * then a `HEAD` answer's body dropped.
 */
export const serveController = (
  { entry, params }: ControllerMatch,
  request: Request,
  { status, bodyLimit }: ServeDefaults,
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
    // The Controller's own `bodyLimit`, else the nearest `_defaults.ts` one: the chain runs outermost first.
    const limit = entry.options.reduce((limit, options) => options.bodyLimit ?? limit, bodyLimit)
    const value = yield* run.run(yield* decodeInput(run, request, { params, limit }))
    return yield* encode(run, value, status())
  })
  const wrapped = entry.options.reduceRight<Effect.Effect<Response, unknown, unknown>>(
    (next, options) => (options.wrap ? options.wrap(next, request) : next),
    face,
  )
  const answer = Effect.catchAll(wrapped, unhandled)
  return method === 'HEAD' ? Effect.map(answer, withoutBody) : answer
}
