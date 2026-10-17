import { handle, type Loaders, NotFound, Redirect, type Route, type Router, type RouteTable } from '@sleekstack/router'
import { configureRuntime, type ErrorSink, runEffect } from '@sleekstack/runtime'
import type { Store, Transfer } from '@sleekstack/ui'
import { Cause, Effect, Layer } from 'effect'
import { type Handler, runHandler } from './handler'
import { type Middleware, runMiddleware } from './middleware'
import { registry, type ServerFn } from './serverFn'
import { requestServices, type RequestServices } from './services'
import { endpoint } from './wire'

// What the app's layer provides: everything the stages need but the router's own services and the request's.
type Needs<R> = Exclude<R, Route | Loaders | Transfer | Store | RequestServices>

/** Required and checked when the stages need services, optional when they need none (or are untyped). */
type StartLayer<R> = 0 extends 1 & R
  ? { readonly layer?: Layer.Layer<any, any, never> }
  : [R] extends [never]
    ? { readonly layer?: Layer.Layer<any, any, never> }
    : { readonly layer: Layer.Layer<R, any, never> }

export type StartOptions<T extends RouteTable, RP, RH, RM, RF> = {
  readonly router: Router<T, RP>
  /** Route handlers by exact pathname. */
  readonly handlers?: { readonly [pathname: string]: Handler<any, RH> }
  /** Run in order before every other stage. */
  readonly middleware?: ReadonlyArray<Middleware<any, RM>>
  /** Server functions, served at `POST /_sleek/fn/<id>`. Ids are unique and `[A-Za-z0-9][A-Za-z0-9_.-]*`. */
  readonly functions?: ReadonlyArray<ServerFn<string, any, any, any, RF>>
  /** Origins besides the request's own allowed to call server functions. */
  readonly origins?: ReadonlyArray<string>
  /** Largest server-function request body, in bytes; larger is 413. Default: 1 MiB. */
  readonly bodyLimit?: number
  /** The runtime's error sink: defects from every stage. Default: `console.error`. */
  readonly onError?: ErrorSink
} & StartLayer<NoInfer<Needs<RP | RH | RM | RF>>>

export interface Start {
  readonly fetch: (request: globalThis.Request) => Promise<Response>
}

const isControl = (e: unknown): e is Redirect | NotFound => e instanceof Redirect || e instanceof NotFound

/**
 * The server entry: configures the runtime over `layer`, and `fetch` answers each request in one Request Scope,
 * through middleware, then server functions, then the route handler for the pathname, then the router's page (an
 * unmatched path is its not-found page with 404). A defect or unhandled failure in any stage reaches `onError` and
 * answers an empty 500. A `Redirect` or `NotFound` from middleware or a handler answers 302 or 404.
 */
export const start = <const T extends RouteTable, RP = never, RH = never, RM = never, RF = never>(
  options: StartOptions<T, RP, RH, RM, RF>,
): Start => {
  const { router, handlers = {}, middleware = [] } = options
  const serverFunctions = endpoint(registry(options.functions ?? []), {
    origins: options.origins ?? [],
    bodyLimit: options.bodyLimit ?? 1024 * 1024,
  })
  const sink: ErrorSink = options.onError ?? ((cause) => console.error(Cause.pretty(cause)))
  configureRuntime({
    layer: (options.layer ?? Layer.empty) as Layer.Layer<never, unknown, never>,
    isControlFlow: isControl,
    onError: sink,
  })
  const page = (request: globalThis.Request) =>
    Effect.flatMap(Effect.context<any>(), (context) =>
      Effect.promise(() =>
        handle(router as Router, request, {
          layer: Layer.succeedContext(context),
          onError: (cause) => sink(cause, { phase: 'call' }),
        }),
      ),
    )
  const fetch = async (request: globalThis.Request): Promise<Response> => {
    const services = requestServices(request)
    const pathname = new URL(request.url).pathname
    const handler = Object.hasOwn(handlers, pathname) ? handlers[pathname] : undefined
    const program = Effect.gen(function* () {
      const response = (yield* runMiddleware(middleware, request)) ?? (yield* serverFunctions(request))
      if (response) return response
      return yield* handler ? runHandler(handler, request) : page(request)
    }).pipe(Effect.catchIf((e) => !isControl(e), Effect.die))
    try {
      return services.finish(await runEffect(program, { request: services.layer }))
    } catch (e) {
      if (e instanceof Redirect)
        return services.finish(new Response(null, { status: 302, headers: { location: e.to } }))
      if (e instanceof NotFound) return services.finish(new Response(null, { status: 404 }))
      return services.finish(new Response(null, { status: 500 }))
    }
  }
  return { fetch }
}
