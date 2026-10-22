import { handle, type Loaders, NotFound, Redirect, type Router, type RouteTable } from '@sleekstack/router'
import { configureRuntime, type ErrorSink, runEffect } from '@sleekstack/runtime'
import type { Store, Transfer } from '@sleekstack/ui'
import { Cause, Effect, Layer } from 'effect'
import type { ControllerEntry, DiscoveredApp } from './app'
import { matchController, serveController } from './controller'
import { type Handler, runHandler } from './handler'
import { type Middleware, runMiddleware } from './middleware'
import { normalizeOrigin } from './origin'
import { registry, type ServerFn, serviceFunctions } from './serverFn'
import type { ServerServiceEntry } from './service'
import { requestServices, type RequestServices } from './services'
import { endpoint } from './wire'

// What the app's layer provides: everything the stages need but the router's own services and the request's. The
// router's `R` already leaves out the `Route` it gives matched pages; a `Route` left in it is for `notFound`.
type Needs<R> = Exclude<R, Loaders | Transfer | Store | RequestServices>

/** Required and checked when the stages need services, optional when they need none (or are untyped). */
type StartLayer<R> = 0 extends 1 & R
  ? { readonly layer?: Layer.Layer<any, any, never> }
  : [R] extends [never]
    ? { readonly layer?: Layer.Layer<any, any, never> }
    : { readonly layer: Layer.Layer<R, any, never> }

/** The Tag of each registry entry in `E`: a registry of several Tags needs each one, so it is read per entry, not inferred as one. */
type TagsOf<E> = E extends ServerServiceEntry<infer Id, any> ? Id : never

/** What `start` takes: the router, handlers by pathname, and the layer the app's requirements come from. */
export type StartOptions<T extends RouteTable, RP, RH, RM, RF, SE extends ServerServiceEntry = never> = {
  /** The page router. Default: the discovered app's; with neither, every page answers 404. */
  readonly router?: Router<T, RP>
  /** Route handlers by exact pathname. */
  readonly handlers?: { readonly [pathname: string]: Handler<any, RH> }
  /** Controllers besides the discovered ones, matched after them in list order. */
  readonly controllers?: ReadonlyArray<ControllerEntry>
  /** Run in order before every other stage. */
  readonly middleware?: ReadonlyArray<Middleware<any, RM>>
  /** Server functions, served at `POST /_sleek/fn/<id>`. Ids are unique and `[A-Za-z0-9][A-Za-z0-9_.-]*`. */
  readonly functions?: ReadonlyArray<ServerFn<string, any, any, any, RF>>
  /**
   * Server Services (the generated registry), each method served at `POST /_sleek/fn/<Tag id>.<method>`. `layer` must
   * provide every Tag; ids share the `functions` rules.
   */
  readonly services?: ReadonlyArray<SE>
  /**
   * Origins besides the request's own allowed to call server functions, each a bare origin such as
   * `https://app.example`; anything else fails `start` with `InvalidOrigin`. This sends no CORS headers: middleware does.
   */
  readonly origins?: ReadonlyArray<string>
  /** Largest server-function request body, in bytes; larger is 413. Default: 1 MiB. */
  readonly bodyLimit?: number
  /** The runtime's error sink: defects from every stage. Default: `console.error`. */
  readonly onError?: ErrorSink
} & StartLayer<NoInfer<Needs<RP | RH | RM | RF | TagsOf<SE>>>>

/** The app `start` returns: a standard `fetch` handler. */
export interface Start {
  readonly fetch: (request: globalThis.Request) => Promise<Response>
}

const isControl = (e: unknown): e is Redirect | NotFound => e instanceof Redirect || e instanceof NotFound

const MISSING_APP =
  'sleekstack: start() was given no options and found no discovered app (virtual:sleek/server-app). Add serverServices() or sleekstack() from @sleekstack/ui-vite to the Vite config, or pass the options.'

/**
 * The app the Vite plugin discovered, imported on the first request, never at module load: its Controllers may import
 * `start` themselves. Without the plugin nothing is discovered: an empty app stands in when options were given, and
 * with none every request fails naming the plugin.
 */
const discover = (explicit: boolean): Promise<DiscoveredApp> =>
  import('./discovered').then(({ default: app }) => {
    if (app) return app
    if (explicit) return { controllers: [] }
    throw new Error(MISSING_APP)
  })

/**
 * The server entry: configures the runtime over `layer`, and `fetch` answers each request in one Request Scope,
 * through middleware, then server functions and Server Service methods, then the route handler for the pathname, then
 * the first Controller matching the path, then the router's page (an unmatched path is its not-found page with 404). A defect or unhandled failure in any stage reaches `onError` and
 * answers an empty 500. A `Redirect` or `NotFound` from middleware or a handler answers 302 or 404.
 *
 * Options merge with the discovered app, which `serverServices()` from `@sleekstack/ui-vite` serves as
 * `virtual:sleek/server-app` and `start` reads on the first request: with no `router` pages come from the discovered
 * one, and with neither every page answers 404. Called with no options and no discovered app, every request fails
 * naming the plugin.
 */
export const start = <
  const T extends RouteTable,
  RP = never,
  RH = never,
  RM = never,
  RF = never,
  SE extends ServerServiceEntry = never,
>(
  options: StartOptions<T, RP, RH, RM, RF, SE> = {} as StartOptions<T, RP, RH, RM, RF, SE>,
): Start => {
  const { handlers = {}, middleware = [] } = options
  const explicit = Object.keys(options).length > 0
  let discovered: Promise<DiscoveredApp> | undefined
  const serverFunctions = endpoint(
    registry([...(options.functions ?? []), ...serviceFunctions(options.services ?? [])]),
    {
      origins: (options.origins ?? []).map(normalizeOrigin),
      bodyLimit: options.bodyLimit ?? 1024 * 1024,
    },
  )
  const sink: ErrorSink = options.onError ?? ((cause) => console.error(Cause.pretty(cause)))
  configureRuntime({
    layer: (options.layer ?? Layer.empty) as Layer.Layer<never, unknown, never>,
    isControlFlow: isControl,
    onError: sink,
  })
  // Pages render on the request fiber's runtime: its services, FiberRefs, tracer and devtools scope.
  const page = (router: Router | undefined, request: globalThis.Request) =>
    router
      ? Effect.flatMap(Effect.runtime<never>(), (runtime) =>
          Effect.promise(() =>
            handle(router, request, { runtime, onError: (cause) => sink(cause, { phase: 'call' }) }),
          ),
        )
      : Effect.succeed(new Response(null, { status: 404 }))
  const fetch = async (request: globalThis.Request): Promise<Response> => {
    const app = await (discovered ??= discover(explicit).then((found) => ({
      ...found,
      controllers: [...found.controllers, ...(options.controllers ?? [])],
    })))
    const router = (options.router as Router | undefined) ?? app.router
    const services = requestServices(request)
    const pathname = new URL(request.url).pathname
    const handler = Object.hasOwn(handlers, pathname) ? handlers[pathname] : undefined
    const program = Effect.gen(function* () {
      const response = (yield* runMiddleware(middleware, request)) ?? (yield* serverFunctions(request))
      if (response) return response
      if (handler) return yield* runHandler(handler, request)
      const controller = matchController(app.controllers, pathname)
      return yield* controller ? serveController(controller, request, services.status) : page(router, request)
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
