import { Context, Effect, Layer, Scope } from 'effect'
import type { ControllerModules } from 'virtual:sleek/server-app'
import type { RpcWrap } from './app'
import type { NetworkError } from './client'
import type { Method } from './handler'
import { Request, type RequestServices } from './services'
import type { DecodeError } from './wire'

/** The methods of a generated Server Service as written: at most one input, any services. */
export type GeneratedMethods = { readonly [name: string]: (input: any) => Effect.Effect<any, any, any> }

/** A generated Tag's service type: each method with its services erased and `NetworkError | DecodeError` added. */
export type GeneratedServiceShape<Methods> = {
  readonly [K in keyof Methods]: Methods[K] extends (...input: infer In) => Effect.Effect<infer A, infer E, any>
    ? (...input: In) => Effect.Effect<A, E | NetworkError | DecodeError>
    : never
}

type RequirementsOf<Methods> = {
  [K in keyof Methods]: Methods[K] extends (...input: any) => Effect.Effect<any, any, infer R> ? R : never
}[keyof Methods]

/**
 * The implementation Layer of a generated Server Service. The build-time services are captured once, when the Layer
 * is built. The request services come from the fiber of each call: the endpoint's Request Scope on the wire, or the
 * request fiber when a page's loader calls the Tag in process. With a `wrap`, every call runs inside it, on the wire
 * and in process alike. A service that the `wrap` provides is not a requirement of the Layer, so with a `wrap` its
 * requirements are untyped.
 *
 * @example
 * ```ts
 * import { type GeneratedServiceShape, serviceLayer } from '@sleekstack/start'
 * import { Context, Effect } from 'effect'
 *
 * const methods = { ping: (): Effect.Effect<string> => Effect.succeed('pong') }
 * class Pinger extends Context.Tag('Pinger')<Pinger, GeneratedServiceShape<typeof methods>>() {}
 *
 * export const PingerLive = serviceLayer(Pinger, methods)
 * ```
 */
export function serviceLayer<Id, Methods extends GeneratedMethods>(
  tag: Context.Tag<Id, GeneratedServiceShape<NoInfer<Methods>>>,
  methods: Methods,
): Layer.Layer<Id, never, Exclude<RequirementsOf<Methods>, RequestServices>>
export function serviceLayer<Id, Methods extends GeneratedMethods>(
  tag: Context.Tag<Id, GeneratedServiceShape<NoInfer<Methods>>>,
  methods: Methods,
  wrap: RpcWrap | undefined,
): Layer.Layer<Id, never, any>
export function serviceLayer(
  tag: Context.Tag<any, any>,
  methods: GeneratedMethods,
  wrap?: RpcWrap,
): Layer.Layer<unknown, never, any> {
  return Layer.effect(
    tag,
    Effect.map(Effect.context<never>(), (context) => {
      // Not the Layer's build Scope: a method's finalizers belong to its call, not to the app.
      const build = Context.omit(Scope.Scope)(context) as Context.Context<never>
      const run = (method: GeneratedMethods[string]) => (input: unknown) =>
        wrap
          ? Effect.flatMap(Request, (request) => Effect.provide(wrap(method(input), request), build))
          : Effect.provide(method(input), build)
      return Object.fromEntries(Object.entries(methods).map(([name, method]) => [name, run(method)]))
    }),
  )
}

/** Each Controller Method a Manifest can wrap, as `'VERB route-name'`, from the generated route table. */
export type RpcRoute = {
  [R in keyof ControllerModules & string]: `${Extract<keyof ControllerModules[R], Method>} ${R}`
}[keyof ControllerModules & string]

/** The options of the RPC Manifest, applying to every service it defines. */
export interface RpcManifestOptions {
  /** Runs inside each wrapped method, on the wire and in process; the Controller directory's `wrap` never does. */
  readonly wrap?: RpcWrap
  /** Largest request body in bytes of the Manifest's methods. */
  readonly bodyLimit?: number
  /** Origins added to the app-wide allow-list of the server-function wire. */
  readonly origins?: ReadonlyArray<string>
}

/** The RPC Manifest as `rpc` returns it: the services and their options. */
export interface RpcManifest<Services> {
  readonly services: Services
  readonly options: RpcManifestOptions
}

/**
 * Declares the RPC Manifest, the default export of `server/rpc.ts`: each Service name maps its methods to the
 * Controller Methods they wrap, as `'VERB route-name'`. A route name is typed from the generated route table, so
 * renaming a Controller or removing a verb is a type error here.
 *
 * @example
 * ```ts
 * import { rpc } from '@sleekstack/start'
 *
 * // As the generated declaration writes it: each Controller's module by its route name.
 * declare module 'virtual:sleek/server-app' {
 *   interface ControllerModules {
 *     readonly 'api/tally': { readonly GET: unknown; readonly POST: unknown }
 *   }
 * }
 *
 * export default rpc({ Tally: { read: 'GET api/tally', add: 'POST api/tally' } })
 * ```
 */
export const rpc = <const Services extends { readonly [service: string]: { readonly [method: string]: RpcRoute } }>(
  services: Services,
  options: RpcManifestOptions = {},
): RpcManifest<Services> => ({ services, options })
