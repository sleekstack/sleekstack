import { handle, type Loaders, NotFound, Redirect, type Router, type RouteTable } from '@sleekstack/router'
import { configureRuntime, type ErrorSink, runEffect } from '@sleekstack/runtime'
import type { Store, Transfer } from '@sleekstack/ui'
import { Cause, Effect, Layer } from 'effect'
import type { GeneratedServices, LayerFileServices } from 'virtual:sleek/server-app'
import type { ControllerEntry, DiscoveredApp } from './app'
import { matchController, serveController } from './controller'
import { type Handler, runHandler } from './handler'
import { type Middleware, runMiddleware } from './middleware'
import { normalizeOrigin } from './origin'
import { registry, type ServerFn, serviceFunctions } from './serverFn'
import type { ServerServiceEntry } from './service'
import { requestServices, type RequestServices } from './services'
import { endpoint } from './wire'

/** What the Layer Files provide (from the generated declaration): the explicit `layer` may require it. */
type FileServices = LayerFileServices[keyof LayerFileServices]

// What the app's layer provides: everything the stages need but the router's own services, the request's and what the
// discovered app provides. The router's `R` already leaves out the `Route` it gives matched pages; a `Route` left in it
// is for `notFound`.
type Needs<R> = Exclude<
  R,
  Loaders | Transfer | Store | RequestServices | FileServices | GeneratedServices[keyof GeneratedServices]
>

/** Required and checked when the stages need services, optional when they need none (or are untyped). */
type StartLayer<R> = 0 extends 1 & R
  ? { readonly layer?: Layer.Layer<any, any, FileServices> }
  : [R] extends [never]
    ? { readonly layer?: Layer.Layer<any, any, FileServices> }
    : { readonly layer: Layer.Layer<R, any, FileServices> }

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
   * provide every Tag; ids share the `functions` rules. An entry whose Tag is already listed registers nothing.
   */
  readonly services?: ReadonlyArray<SE>
  /**
   * Origins besides the request's own allowed to call server functions, each a bare origin such as
   * `https://app.example`; anything else fails `start` with `InvalidOrigin`. The `origins` export of every Controller
   * file, RPC File, the RPC Manifest and `_defaults.ts` adds to them. This sends no CORS headers: middleware does.
   */
  readonly origins?: ReadonlyArray<string>
  /**
   * Largest request body, in bytes, of a server function and of a Controller or generated Server Service with no
   * `bodyLimit` export of its own or in a `_defaults.ts` above it; larger is 413. Default: 1 MiB.
   */
  readonly bodyLimit?: number
  /** The runtime's error sink: defects from every stage. Default: the Server Root's `onError`, else `console.error`. */
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
 * The discovered app with the Controllers given as options after its own, the server-function stage over the union
 * of `origins` and every file's `origins`, and the error sink.
 */
interface Loaded extends DiscoveredApp {
  readonly serverFunctions: (request: globalThis.Request) => Effect.Effect<Response | undefined, unknown, unknown>
  readonly sink: ErrorSink
}

/** The nearest `bodyLimit` of an option chain (outermost first). */
const nearest = (chain: ReadonlyArray<{ readonly bodyLimit?: number }>): number | undefined => {
  for (let i = chain.length - 1; i >= 0; i--) if (chain[i]!.bodyLimit !== undefined) return chain[i]!.bodyLimit
  return undefined
}

/**
 * The app's Layer: the Layer Files with the explicit `layer` over them, the generated implementation Layers over both,
 * and the explicit `layer` again on top, so it wins for any Tag it provides. It is one Layer object, built once.
 */
const appLayer = (
  files: Layer.Layer<never, unknown, any>,
  own: Layer.Layer<never, unknown, any> | undefined,
  impls: ReadonlyArray<Layer.Layer<never, unknown, any>>,
): Layer.Layer<never, unknown, never> => {
  const base = own ? Layer.provideMerge(own, files) : files
  const app = Layer.provideMerge(Layer.mergeAll(Layer.empty, ...impls), base)
  // Requirements are untyped here: the generated code and `StartOptions` check them.
  return (own ? Layer.provideMerge(own, app) : app) as Layer.Layer<never, unknown, never>
}

/**
 * The server entry: configures the runtime over `layer` on the first request, and `fetch` answers each request in one Request Scope,
 * through middleware, then server functions and Server Service methods, then the route handler for the pathname, then
 * the first Controller matching the path, then the router's page (an unmatched path is its not-found page with 404). A defect or unhandled failure in any stage reaches `onError` and
 * answers an empty 500. A `Redirect` or `NotFound` from middleware or a handler answers 302 or 404.
 *
 * Options merge with the discovered app, which `serverServices()` from `@sleekstack/ui-vite` serves as
 * `virtual:sleek/server-app` and `start` reads on the first request: with no `router` pages come from the discovered
 * one, and with neither every page answers 404. The runtime's Layer is the discovered Layer Files and generated
 * Server Services with `layer` over them: `layer` may require what the Layer Files provide and wins for any Tag it
 * provides. An explicit `onError` wins over the Server Root's. Called with no options and no discovered app, every
 * request fails naming the plugin.
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
  const { handlers = {}, middleware = [], bodyLimit = 1024 * 1024 } = options
  const explicit = Object.keys(options).length > 0
  const entries = options.services ?? []
  // By Tag identity: the generated registry passed beside the discovered app registers nothing twice.
  const listed = (tag: ServerServiceEntry['tag'], i: number) => entries.findIndex((other) => other.tag === tag) < i
  const own = [...(options.functions ?? []), ...serviceFunctions(entries.filter((entry, i) => !listed(entry.tag, i)))]
  // Thrown here, at the call: `DuplicateServerFn` and `InvalidServerFnId` of the explicit options.
  registry(own)
  const origins = (options.origins ?? []).map(normalizeOrigin)
  let loaded: Promise<Loaded> | undefined
  const load = () =>
    discover(explicit).then((found): Loaded => {
      const controllers = [...found.controllers, ...(options.controllers ?? [])]
      const generated = found.services ?? []
      const chain = [...controllers.flatMap((c) => c.options), ...generated.flatMap((s) => s.options)]
      for (const o of chain)
        if (o.bodyLimit !== undefined && !(Number.isInteger(o.bodyLimit) && o.bodyLimit > 0))
          throw new Error(`sleekstack: bodyLimit in ${o.file} must be a positive finite integer, got ${o.bodyLimit}.`)
      const added = chain.flatMap((o) => o.origins ?? []).map(normalizeOrigin)
      const limits = new Map(
        generated.flatMap(({ entry, options }) => {
          const limit = nearest(options)
          return limit === undefined
            ? []
            : Object.keys(entry.methods).map((m) => [`${entry.tag.key}.${m}`, limit] as const)
        }),
      )
      const functions = registry([
        ...own,
        ...serviceFunctions(generated.map((s) => s.entry).filter((e) => !entries.some((other) => other.tag === e.tag))),
      ])
      const sink: ErrorSink = options.onError ?? found.onError ?? ((cause) => console.error(Cause.pretty(cause)))
      configureRuntime({
        layer: appLayer(
          found.layer ?? Layer.empty,
          options.layer,
          generated.map((s) => s.layer),
        ),
        isControlFlow: isControl,
        onError: sink,
      })
      return {
        ...found,
        controllers,
        sink,
        serverFunctions: endpoint(functions, { origins: [...new Set([...origins, ...added])], bodyLimit, limits }),
      }
    })
  // Pages render on the request fiber's runtime: its services, FiberRefs, tracer and devtools scope.
  const page = (router: Router | undefined, request: globalThis.Request, sink: ErrorSink) =>
    router
      ? Effect.flatMap(Effect.runtime<never>(), (runtime) =>
          Effect.promise(() =>
            handle(router, request, { runtime, onError: (cause) => sink(cause, { phase: 'call' }) }),
          ),
        )
      : Effect.succeed(new Response(null, { status: 404 }))
  const fetch = async (request: globalThis.Request): Promise<Response> => {
    const app = await (loaded ??= load())
    const router = (options.router as Router | undefined) ?? app.router
    const services = requestServices(request)
    const pathname = new URL(request.url).pathname
    const handler = Object.hasOwn(handlers, pathname) ? handlers[pathname] : undefined
    const program = Effect.gen(function* () {
      const response = (yield* runMiddleware(middleware, request)) ?? (yield* app.serverFunctions(request))
      if (response) return response
      if (handler) return yield* runHandler(handler, request)
      const controller = matchController(app.controllers, pathname)
      return yield* controller
        ? serveController(controller, request, { status: services.status, bodyLimit })
        : page(router, request, app.sink)
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
