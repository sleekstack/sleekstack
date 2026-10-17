import { NotFound, Redirect } from '@sleekstack/router'
import { Effect, ParseResult, Schema } from 'effect'
import { allowedOrigin } from './origin'
import type { ErrorOf, ServerFn } from './serverFn'

/** Server functions are served at this prefix plus their id. */
export const prefix = '/_sleek/fn/'

/** Input or a response that does not match its Schema (or is not JSON), with one issue per field. */
export class DecodeError extends Schema.TaggedError<DecodeError>()('DecodeError', {
  issues: Schema.Array(
    Schema.Struct({ path: Schema.Array(Schema.Union(Schema.String, Schema.Number)), message: Schema.String }),
  ),
}) {}

const decodeError = (error: ParseResult.ParseError): DecodeError =>
  new DecodeError({
    issues: ParseResult.ArrayFormatter.formatErrorSync(error).map((i) => ({
      path: i.path.map((p) => (typeof p === 'number' ? p : String(p))),
      message: i.message,
    })),
  })

const issue = (message: string): DecodeError => new DecodeError({ issues: [{ path: [], message }] })

/**
 * A response body: `Success` / `Failure` (status 200), `Redirect` (302, no `Location`, so `fetch` hands it to the
 * caller instead of following it) and `NotFound` (404). A 400 body is an encoded `DecodeError`.
 */
const Envelope = Schema.Union(
  // JSON drops an `undefined` value (a `Schema.Void` success), so the key may be absent.
  Schema.Struct({ _tag: Schema.Literal('Success'), value: Schema.optional(Schema.Unknown) }),
  Schema.Struct({ _tag: Schema.Literal('Failure'), error: Schema.Unknown }),
  Schema.Struct({ _tag: Schema.Literal('Redirect'), to: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal('NotFound') }),
  DecodeError,
)

const json = (status: number, body: unknown) => Response.json(body, { status })
const empty = (status: number, headers?: HeadersInit) => new Response(null, { status, headers })

/** Reads the body as text, or `undefined` once it passes `limit` bytes. */
const readBody = async (request: Request, limit: number): Promise<string | undefined> => {
  if (Number(request.headers.get('content-length')) > limit) return undefined
  if (!request.body) return ''
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel()
      return undefined
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

type Fn<R> = ServerFn<string, AnySchema, AnySchema, AnySchema | undefined, R>
type AnySchema = Schema.Schema<any, any, never>

const run = <R>(fn: Fn<R>, input: unknown) =>
  Effect.gen(function* () {
    const result = yield* Effect.either(fn(input))
    if (result._tag === 'Right') {
      const value = yield* Effect.orDie(Schema.encode(fn.success)(result.right))
      return json(200, { _tag: 'Success', value })
    }
    const e = result.left
    if (e instanceof Redirect) return json(302, { _tag: 'Redirect', to: e.to })
    if (e instanceof NotFound) return json(404, { _tag: 'NotFound' })
    if (fn.error && Schema.is(fn.error)(e))
      return json(200, { _tag: 'Failure', error: yield* Effect.orDie(Schema.encode(fn.error)(e)) })
    // Undeclared: the error sink gets it and the caller an opaque 500.
    return yield* Effect.fail(e)
  })

export interface EndpointOptions {
  readonly origins: ReadonlyArray<string>
  readonly bodyLimit: number
}

/**
 * The server-function stage: `undefined` outside `prefix`, else the call's response. Checks run in order: `POST` (405),
 * origin (403), registered id (404, naming none), body size (413), JSON (400) and the input Schema (400 with the
 * issues), all before the body runs.
 */
export const endpoint =
  <R>(functions: ReadonlyMap<string, Fn<R>>, options: EndpointOptions) =>
  (request: Request): Effect.Effect<Response | undefined, unknown, R> =>
    Effect.gen(function* () {
      const pathname = new URL(request.url).pathname
      if (!pathname.startsWith(prefix)) return undefined
      if (request.method.toUpperCase() !== 'POST') return empty(405, { allow: 'POST' })
      if (!allowedOrigin(request, options.origins)) return empty(403)
      const fn = functions.get(pathname.slice(prefix.length))
      if (!fn) return empty(404)
      const text = yield* Effect.promise(() => readBody(request, options.bodyLimit))
      if (text === undefined) return empty(413)
      let body: unknown
      try {
        // An empty body is `undefined` input, which JSON cannot write (a `Schema.Void` input).
        body = text === '' ? undefined : JSON.parse(text)
      } catch {
        return json(400, Schema.encodeSync(DecodeError)(issue('Malformed JSON')))
      }
      const input = yield* Effect.either(Schema.decodeUnknown(fn.input, { errors: 'all' })(body))
      if (input._tag === 'Left') return json(400, Schema.encodeSync(DecodeError)(decodeError(input.left)))
      return yield* run(fn, input.right)
    })

/**
 * A response body read back as the function's result: its success value, or a failure with its declared error, the
 * router's own `Redirect` / `NotFound`, or a `DecodeError` (a 400 body, or a body or envelope that does not decode).
 */
export const decodeResult = <F extends ServerFn>(
  fn: F,
  body: unknown,
): Effect.Effect<Schema.Schema.Type<F['success']>, ErrorOf<F['error']> | Redirect | NotFound | DecodeError> =>
  Effect.gen(function* () {
    const envelope = yield* Schema.decodeUnknown(Envelope)(body)
    switch (envelope._tag) {
      case 'Success':
        return yield* Schema.decodeUnknown(fn.success)(envelope.value)
      case 'Failure':
        if (!fn.error) return yield* issue('A failure the function does not declare')
        return yield* Effect.flatMap(Schema.decodeUnknown(fn.error)(envelope.error), Effect.fail)
      case 'Redirect':
        return yield* new Redirect({ to: envelope.to })
      case 'NotFound':
        return yield* new NotFound()
      case 'DecodeError':
        return yield* envelope
    }
  }).pipe(Effect.catchIf(ParseResult.isParseError, (e) => Effect.fail(decodeError(e))))
