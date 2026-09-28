/**
 * packages/core/src/service.ts
 *
 * Spike (fn-1 task .2): hybrid service definitions. A definition is a value
 * created once (so Layer memoization holds) carrying both the Effect Layer and
 * the runtime metadata (provided Tag, required Tags, lifetime) the graph needs.
 * The Layer's requirement type is derived from `requires`, so the two cannot drift.
 */

import { Context, Effect, Layer, type Scope } from 'effect'

/** How long a service instance lives: once per app, per request scope, or per component scope. */
export type Lifetime = 'app' | 'request' | 'component'

type AnyTag = Context.Tag<any, any>

/** Resolved services for a `requires` tuple, in the same order. */
export type Deps<Req extends readonly AnyTag[]> = {
  readonly [K in keyof Req]: Context.Tag.Service<Req[K]>
}

/**
 * A service created by {@link service}: the Effect Layer plus the graph metadata
 * (provided Tag, required Tags, lifetime) that `buildGraph` validates.
 */
export interface ServiceDefinition<I, S, E, R, L extends Lifetime> {
  readonly _tag: 'ServiceDefinition'
  readonly tag: Context.Tag<I, S>
  readonly requires: readonly AnyTag[]
  readonly lifetime: L
  /** false when `lifetime` was defaulted, so a module lifetime may apply */
  readonly explicitLifetime: boolean
  readonly layer: Layer.Layer<I, E, R>
}

/** A {@link ServiceDefinition} with its type parameters erased, for heterogeneous lists. */
export type AnyServiceDefinition = ServiceDefinition<any, any, any, any, Lifetime>

/**
 * Defines a service: the Tag it provides, the Tags it requires, and the Effect that builds it.
 *
 * The resulting Layer's requirement type is derived from `requires`, so the two cannot drift.
 * Acquisition runs in a `Scope`, so finalizers added with `Effect.addFinalizer` run when the
 * owning scope closes.
 *
 * @param tag - The Tag this service provides.
 * @param options - `requires`: Tags resolved and passed to `make` in order; `lifetime`: defaults to `'app'`.
 * @param make - Builds the service from its resolved dependencies.
 * @returns A service definition to list in a module's `entries`.
 *
 * @example
 * ```ts
 * import { Context, Effect } from 'effect'
 * import { service } from '@sleekstack/core'
 *
 * class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
 * class Greeter extends Context.Tag('Greeter')<Greeter, { greet(): string }>() {}
 *
 * const ClockLive = service(Clock, {}, () => Effect.succeed({ now: () => Date.now() }))
 * const GreeterLive = service(Greeter, { requires: [Clock] }, ([clock]) =>
 *   Effect.succeed({ greet: () => `hello at ${clock.now()}` }))
 * ```
 */
export function service<
  I,
  S,
  const Req extends readonly AnyTag[] = [],
  E = never,
  L extends Lifetime = 'app',
>(
  tag: Context.Tag<I, S>,
  options: { readonly requires?: Req; readonly lifetime?: L },
  make: (deps: Deps<Req>) => Effect.Effect<S, E, Scope.Scope>,
): ServiceDefinition<I, S, E, Context.Tag.Identifier<Req[number]>, L> {
  const requires = (options.requires ?? []) as unknown as Req
  const acquire = Effect.flatMap(
    Effect.all(requires as readonly AnyTag[]) as unknown as Effect.Effect<Deps<Req>, never, never>,
    make,
  )
  return {
    _tag: 'ServiceDefinition',
    tag,
    requires,
    lifetime: (options.lifetime ?? 'app') as L,
    explicitLifetime: options.lifetime !== undefined,
    layer: Layer.scoped(tag, acquire) as unknown as Layer.Layer<I, E, Context.Tag.Identifier<Req[number]>>,
  }
}

// ---------------------------------------------------------------------------
// Type-level captive-dependency check (spike, R5 "where feasible").
// Given the full tuple of definitions, yields a union of readable violation
// strings, or `never` when every edge respects the lifetime matrix.

type Allowed<L extends Lifetime> = L extends 'app'
  ? 'app'
  : L extends 'request'
    ? 'app' | 'request'
    : 'app' | 'component'

type ViolationsFor<P, R, L extends Lifetime, Name extends string> =
  P extends ServiceDefinition<infer I, any, any, any, infer PL>
    ? [I] extends [R]
      ? PL extends Allowed<L>
        ? never
        : `${Name} (${L}) captures ${TagName<P>} (${PL})`
      : never
    : never

type TagName<D> = D extends ServiceDefinition<infer I, any, any, any, any>
  ? I extends { readonly Id: infer K extends string } ? K : string
  : string

/**
 * Type-level captive-dependency check: a union of readable violation strings for a tuple of
 * definitions, or `never` when every edge respects the lifetime matrix.
 */
export type CaptiveViolations<Defs extends readonly AnyServiceDefinition[]> = {
  [K in keyof Defs]: Defs[K] extends ServiceDefinition<any, any, any, infer R, infer L>
    ? ViolationsFor<Defs[number], R, L, TagName<Defs[K]>>
    : never
}[number]
