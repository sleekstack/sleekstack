import { NotFound, Redirect, router, routes } from '@sleekstack/router'
import {
  DecodeError,
  type Handler,
  type RequestServices,
  type ServerFn,
  type ServerServiceEntry,
  start,
} from '@sleekstack/start'
import type { NetworkError } from '@sleekstack/start/client'
import { type Cause, Effect, Exit, type Layer, Schema } from 'effect'

type AnySchema = Schema.Schema<any, any, never>

export interface CallOptions<R> {
  /** The services the function or handler needs; the request services are provided per call. */
  readonly layer: Layer.Layer<Exclude<R, RequestServices>, any, never>
  /** Request headers, such as `cookie`. The `origin` defaults to the request's own. */
  readonly headers?: HeadersInit
}

const origin = 'http://sleekstack.test'

// A server function or a handler answers first, so no page is ever reached.
const noPages = router({
  table: routes({}),
  pages: {},
  notFound: () => Effect.dieMessage('@sleekstack/testing: no page'),
})

// The same dispatch as an app's `fetch`. `start` configures the runtime, so this replaces the configured one.
const serve = (options: object, request: Request): Promise<Response> =>
  start({ router: noPages, ...options } as never).fetch(request)

// The envelope `start` answered, read back as the function's result.
const envelope = (fn: ServerFn, body: any): Effect.Effect<unknown, unknown> => {
  switch (body?._tag) {
    case 'Success':
      return Effect.orDie(Schema.decodeUnknown(fn.success)(body.value))
    case 'Failure':
      return Effect.flatMap(Effect.orDie(Schema.decodeUnknown(fn.error as AnySchema)(body.error)), Effect.fail)
    case 'Redirect':
      return Effect.fail(new Redirect({ to: body.to }))
    case 'NotFound':
      return Effect.fail(new NotFound())
    case 'DecodeError':
      return Effect.flatMap(Effect.orDie(Schema.decodeUnknown(DecodeError)(body)), Effect.fail)
  }
  return Effect.dieMessage(`@sleekstack/testing: not a server-function envelope: ${JSON.stringify(body)}`)
}

// Posts `input` to `fn.id` on an app serving `served`, and reads the answer back as `fn`'s result.
const post = async (
  fn: ServerFn,
  input: unknown,
  options: CallOptions<any>,
  served: object,
): Promise<Exit.Exit<any, any>> => {
  // Input the Schema rejects is sent as given, so the server's own decode reports it.
  const encoded = Schema.encodeEither(fn.input)(input)
  const body = encoded._tag === 'Right' ? encoded.right : input
  const headers = new Headers(options.headers)
  if (!headers.has('origin')) headers.set('origin', origin)
  headers.set('content-type', 'application/json')
  let defect: Cause.Cause<unknown> | undefined
  const response = await serve(
    { layer: options.layer, ...served, onError: (cause: Cause.Cause<unknown>) => void (defect = cause) },
    new Request(`${origin}/_sleek/fn/${fn.id}`, {
      method: 'POST',
      headers,
      // A `Schema.Void` input has no JSON form; the server reads an empty body as `undefined`.
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
  if (defect) return Exit.failCause(defect)
  const text = await response.text()
  const result = Effect.suspend(() => envelope(fn, JSON.parse(text)))
  return Effect.runPromiseExit(
    Effect.catchAllDefect(result, () =>
      Effect.dieMessage(`@sleekstack/testing: ${fn.id} answered ${response.status} ${text}`),
    ),
  )
}

/**
 * Calls `fn` through the same checks as `start(...).fetch` (origin, input decode, output encode), with `layer` and
 * no network. Resolves to its result as an `Exit`: the success value, the declared error, the router's `Redirect` /
 * `NotFound`, or a `DecodeError` for input that fails the input Schema. An undeclared failure or defect is the cause
 * `start` gave its error sink.
 */
export const callServerFn = <In extends AnySchema, Out extends AnySchema, Err extends AnySchema | undefined, R>(
  fn: ServerFn<string, In, Out, Err, R>,
  input: Schema.Schema.Type<In>,
  options: CallOptions<R>,
): Promise<
  Exit.Exit<
    Schema.Schema.Type<Out>,
    (Err extends AnySchema ? Schema.Schema.Type<Err> : never) | Redirect | NotFound | DecodeError
  >
> => post(fn as ServerFn, input, options, { functions: [fn] })

type Method<Service, K extends keyof Service> = Service[K] extends (
  ...input: any
) => Effect.Effect<infer Out, infer Err>
  ? Effect.Effect<Out, Err>
  : never

/**
 * Calls one method of a Server Service through the same wire as `callServerFn`: `entry` is its registry entry, and
 * `layer` provides the Tag (the implementation, or a test Layer). Resolves to an `Exit` like `callServerFn`.
 */
export const callService = <Id, Service, K extends keyof Service & string>(
  entry: ServerServiceEntry<Id, Service>,
  method: K,
  input: Service[K] extends (...input: infer In) => any ? In[0] : never,
  options: CallOptions<Id>,
): Promise<
  Exit.Exit<
    Effect.Effect.Success<Method<Service, K>>,
    Exclude<Effect.Effect.Error<Method<Service, K>>, NetworkError> | Redirect | NotFound | DecodeError
  >
> => {
  // `post` reads only the id and Schemas.
  const fn = { ...entry.methods[method], id: `${entry.tag.key}.${method}` } as unknown as ServerFn
  return post(fn, input, options, { services: [entry] })
}

/**
 * Answers `request` with `handler` through the same dispatch as `start(...).fetch` (request services, `Set-Cookie`,
 * 405 with `Allow`, 302 / 404 for the router's control flow, an empty 500 for a failure), with `layer` and no network.
 * The handler is served at the request's pathname.
 */
export const callHandler = <R>(
  handler: Handler<any, R>,
  request: Request,
  options: Pick<CallOptions<R>, 'layer'>,
): Promise<Response> => serve({ layer: options.layer, handlers: { [new URL(request.url).pathname]: handler } }, request)
