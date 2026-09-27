/**
 * packages/core/src/service.ts
 *
 * Spike (fn-1 task .2): hybrid service definitions. A definition is a value
 * created once (so Layer memoization holds) carrying both the Effect Layer and
 * the runtime metadata (provided Tag, required Tags, lifetime) the graph needs.
 * The Layer's requirement type is derived from `requires`, so the two cannot drift.
 */

import { Context, Effect, Layer, type Scope } from 'effect'

export type Lifetime = 'app' | 'request' | 'component'

type AnyTag = Context.Tag<any, any>

/** Resolved services for a `requires` tuple, in the same order. */
export type Deps<Req extends readonly AnyTag[]> = {
  readonly [K in keyof Req]: Context.Tag.Service<Req[K]>
}

export interface ServiceDefinition<I, S, E, R, L extends Lifetime> {
  readonly _tag: 'ServiceDefinition'
  readonly tag: Context.Tag<I, S>
  readonly requires: readonly AnyTag[]
  readonly lifetime: L
  /** false when `lifetime` was defaulted, so a module lifetime may apply */
  readonly explicitLifetime: boolean
  readonly layer: Layer.Layer<I, E, R>
}

export type AnyServiceDefinition = ServiceDefinition<any, any, any, any, Lifetime>

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

export type CaptiveViolations<Defs extends readonly AnyServiceDefinition[]> = {
  [K in keyof Defs]: Defs[K] extends ServiceDefinition<any, any, any, infer R, infer L>
    ? ViolationsFor<Defs[number], R, L, TagName<Defs[K]>>
    : never
}[number]
