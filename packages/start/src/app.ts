import type { Router } from '@sleekstack/router'
import type { Effect, Schema } from 'effect'
import type { Method } from './handler'

type AnySchema = Schema.Schema<any, any, never>

/**
 * One Controller Method as the discovered app carries it: the exported function and the Schemas read from its
 * written-out signature, which is erased at run time. A part the signature does not declare has no Schema; with no
 * `success` the answer is serialized as it is.
 */
export interface ControllerMethodEntry {
  /** The Controller Method: decoded `{ params?, query?, body? }` in, the answer's Effect out. */
  readonly run: (input: any) => Effect.Effect<unknown, unknown, unknown>
  /** Decodes `params` from the path's strings. */
  readonly params?: AnySchema
  /** Decodes `query` from the URL's strings. */
  readonly query?: AnySchema
  /** Decodes `body` from its JSON. */
  readonly body?: AnySchema
  /** Encodes the answer's value. */
  readonly success?: AnySchema
}

/**
 * The type of a `wrap` export of a Controller or Directory Defaults (`_defaults.ts`) file: `next` is the Controller's
 * HTTP face (decode, method, encode), and `wrap` provides services such as the viewer and maps failures, the routing
 * failures (`InvalidPathEncoding`, `MethodNotAllowed`, `BodyTooLarge`, `UnsupportedMediaType`) and decode failures
 * included, to answers. Wraps compose outer first. A `Redirect` or `NotFound` it lets through answers 302 or 404.
 *
 * `sleekstack check` reads the services a `wrap` provides from its written signature: those in `next`'s requirements
 * that its result leaves out. A `wrap: Wrap` annotation is untyped there and provides nothing, so a `wrap` that
 * provides a service writes its signature out:
 *
 * @example
 * ```ts
 * export const wrap = (
 *   next: Effect.Effect<Response, unknown, Viewer>,
 *   request: Request,
 * ): Effect.Effect<Response, unknown> => Effect.provideService(next, Viewer, viewerFrom(request))
 * ```
 */
export type Wrap = (next: Effect.Effect<Response, any, any>, request: Request) => Effect.Effect<Response, any, any>

/**
 * The type of an RPC File's `wrap` export (ADR 0054): it runs inside each method of the generated Server Service and
 * keeps the method's value and error types, providing services or recovering within them.
 */
export type RpcWrap = <A, E, R>(next: Effect.Effect<A, E, R>, request: Request) => Effect.Effect<A, E, any>

/** The option exports of one Controller or Directory Defaults (`_defaults.ts`) file. */
export interface ControllerOptions {
  /** The file the options come from, named when one of them is invalid. */
  readonly file: string
  /** Runs around decode, method and encode: provides services and maps failures to answers. */
  readonly wrap?: Wrap
  /** Largest request body in bytes, when the method declares `body`. */
  readonly bodyLimit?: number
  /** Origins added to the app-wide allow-list of the server-function wire. */
  readonly origins?: ReadonlyArray<string>
}

/** One discovered Controller: where it is served, its methods and the options that apply to it. */
export interface ControllerEntry {
  /** The route name: the path under the Controllers directory without `.controller.ts`, such as `articles/[slug]`. */
  readonly route: string
  /** The URL pattern in route table syntax, such as `/articles/:slug`. */
  readonly pattern: string
  /** The exported Controller Methods. */
  readonly methods: { readonly [M in Method]?: ControllerMethodEntry }
  /** The option chain, outermost first: each `_defaults.ts` from the server directory down, then the Controller's own. */
  readonly options: ReadonlyArray<ControllerOptions>
}

/**
 * The app the Vite plugin discovers, served as the default export of `virtual:sleek/server-app` and read by `start()`
 * on its first request.
 */
export interface DiscoveredApp {
  /** The Controllers, in match order. */
  readonly controllers: ReadonlyArray<ControllerEntry>
  /** The page router built from file routes, when the app has them. */
  readonly router?: Router
}
