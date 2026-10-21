import { type Context, type Effect, Layer } from 'effect'
import type { RequestServices } from './services'

/** A Tag's methods as an implementation writes them: the contract's signatures, each free to use the request services. */
export type Implementation<Service> = {
  readonly [K in keyof Service]: Service[K] extends (...input: infer In) => Effect.Effect<infer Out, infer Err, never>
    ? (...input: In) => Effect.Effect<Out, Err, RequestServices>
    : never
}

/**
 * The implementation Layer of a Server Service. Its methods may use `Request`, `Cookies` and `ResponseHeaders` (any
 * other service is a type error here); each call gets them from the fiber that calls it: the endpoint's Request Scope
 * on the wire, the request fiber's runtime when a page's loader calls the Tag in process.
 *
 * @example
 * ```ts
 * import { Cookies, implement } from '@sleekstack/start'
 * import { Effect } from 'effect'
 * import { Session } from './session'
 *
 * export const SessionLive = implement(Session, {
 *   whoami: () => Effect.map(Cookies, (cookies) => cookies.get('session') ?? null),
 * })
 * ```
 */
export const implement = <Id, Service>(
  tag: Context.Tag<Id, Service>,
  methods: Implementation<Service>,
): Layer.Layer<Id> =>
  // The Tag's type hides the requirement: every caller runs inside a request, which provides it.
  Layer.succeed(tag, methods as Service)
