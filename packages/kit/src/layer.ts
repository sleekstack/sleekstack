/**
 * packages/kit/src/layer.ts
 *
 * `layer()` lowers to a core `declareLayer()` node: resolve the deps tuple, then construct
 * (class), call (factory, sync or async) or return (value). A `withCleanup`
 * result lowers to acquireRelease.
 */

import { Context, Effect, Layer as EffectLayer, Option } from 'effect'
import { isGeneratorFunction, YieldWrap, yieldWrapGet } from 'effect/Utils'
import { declareLayer, Resolver, type DeclaredLayer, type Resolve } from '@sleekstack/core'
import { CleanupFailure, LayerFailure } from './errors'
import { coreTag, keyOf, type AnyTag, type ServiceOf, type TagLike } from './tag'

/** How long a service instance lives: once per app, per request, or per component subtree. */
export type Lifetime = 'app' | 'request' | 'component'

declare const LayerBrand: unique symbol
declare const CleanupBrand: unique symbol

/** An implementation of a Tag, created by `layer()`. */
export interface Layer<T> {
  readonly [LayerBrand]: T
}

/** A service paired with its cleanup, created by `withCleanup()`. */
export interface Cleanup<T> {
  readonly [CleanupBrand]: T
}

/** Options for {@link layer}. */
export interface LayerOptions {
  readonly lifetime?: Lifetime
}

/** Resolved services for a deps tuple, in order. */
export type Services<D extends readonly AnyTag[]> = { -readonly [K in keyof D]: ServiceOf<D[K]> }

type NonCallable<T> = T extends (...args: any) => any ? never : T extends abstract new (...args: any) => any ? never : T

/** What `layer()` accepts as an implementation: a class, a (sync or async) factory, or a plain value. */
export type Impl<T, A extends readonly unknown[]> =
  | (new (...args: A) => T)
  | ((...args: A) => T | Cleanup<T> | Promise<T | Cleanup<T>>)
  | NonCallable<T>

const CLEANUP = Symbol('sleekstack.cleanup')
type CleanupBox = { readonly [CLEANUP]: true; readonly service: unknown; readonly cleanup: () => unknown }

/**
 * Pairs a service with a cleanup that runs when its scope closes. Return it from a `layer()` factory.
 *
 * @param service - The service instance.
 * @param cleanup - Runs on scope close; a throw or rejection is reported to `onFinalizerError` as a plain `FinalizerError` (`{ message, tag }`).
 * @returns The service with its cleanup attached.
 *
 * @example
 * ```ts
 * import { layer, tag, withCleanup } from '@sleekstack/kit'
 *
 * interface Db { query(sql: string): string[]; close(): void }
 * const Db = tag<Db>('Db')
 * const DbLive = layer(Db, () => {
 *   const db: Db = { query: () => [], close: () => {} }
 *   return withCleanup(db, () => db.close())
 * })
 * ```
 */
export function withCleanup<T>(service: T, cleanup: () => void | Promise<void>): Cleanup<T> {
  return { [CLEANUP]: true, service, cleanup } as CleanupBox as unknown as Cleanup<T>
}

const isCleanup = (x: unknown): x is CleanupBox => typeof x === 'object' && x !== null && CLEANUP in x

const isClass = (f: Function) => /^class[\s{]/.test(Function.prototype.toString.call(f))

interface LayerInfo {
  readonly tag: AnyTag
  readonly deps: readonly AnyTag[]
  readonly def: DeclaredLayer
}

const infos = new WeakMap<object, LayerInfo>()

/** @internal The Tag key behind a lowered core entry (for dev tracing); core entries carry no Tag metadata. */
export const defKeys = new WeakMap<object, string>()

/** A generator factory for {@link layer}: its `yield*`ed Tags are its requirements, resolved lazily. */
export type LayerGenerator<T> = () => Generator<unknown, T | Cleanup<T>, any>

// Runs a generator factory: each `yield* Tag` resolves through the building scope's Resolver
// (lazily building its local provider), or the running context when built outside a scope.
const runGenerator = (key: string, factory: () => Iterator<unknown, unknown, unknown>) =>
  Effect.flatMap(Effect.serviceOption(Resolver), (r) => {
    const resolve: Resolve = Option.getOrElse(r, () => ((t: Context.Tag<any, any>) => t) as unknown as Resolve)
    const it = factory()
    const step = (input: unknown): Effect.Effect<unknown, unknown> => {
      let res: IteratorResult<unknown, unknown>
      try {
        res = it.next(input)
      } catch (e) {
        return Effect.fail(new LayerFailure(key, e))
      }
      if (res.done) return Effect.succeed(res.value)
      if (!(res.value instanceof YieldWrap)) return Effect.fail(new LayerFailure(key, new Error('a layer generator must `yield*` Tags, not `yield` values')))
      const y = yieldWrapGet(res.value) as Effect.Effect<unknown, unknown>
      return Effect.flatMap(Context.isTag(y) ? resolve(y) : y, step)
    }
    return Effect.suspend(() => step(undefined))
  })

/**
 * Implements a Tag. `impl` is constructed (class), called (factory, sync or async), or returned as-is (value),
 * with the services of `deps` passed in order. A generator factory (`function* () {...}`) takes no deps array:
 * the Tags it `yield*`s are its requirements, resolved lazily when it builds.
 *
 * @param tag - The Tag to implement.
 * @param impl - A class, a factory (may return {@link withCleanup}), a generator factory, or a value.
 * @param deps - Tags resolved and passed to `impl`, in order (not with a generator factory).
 * @param opts - `lifetime` (default `'app'`).
 * @returns A Layer to list in a module's `provide`.
 * @throws {@link SleekStackError} with code `InvalidTag` when `tag` or a dep is not a `tag()` or named class.
 * @throws {@link SleekStackError} with code `LayerFailed` (when the scope builds) when the factory or constructor throws or rejects.
 * @throws {@link SleekStackError} with code `MissingDependency` (when the scope builds) when a generator yields an unprovided Tag,
 *   or `DependencyCycle` when generator layers yield each other.
 *
 * @example
 * ```ts
 * import { layer, tag } from '@sleekstack/kit'
 *
 * interface Clock { now(): number }
 * interface Greeter { greet(): string }
 * const Clock = tag<Clock>('Clock')
 * const Greeter = tag<Greeter>('Greeter')
 *
 * const ClockLive = layer(Clock, { now: () => Date.now() })
 * const GreeterLive = layer(Greeter, (clock) => ({ greet: () => `hi at ${clock.now()}` }), [Clock], { lifetime: 'request' })
 * const GreeterGen = layer(Greeter, function* () {
 *   const clock = yield* Clock
 *   return { greet: () => `hi at ${clock.now()}` }
 * })
 * ```
 */
export function layer<T, const D extends readonly AnyTag[]>(tag: TagLike<T>, impl: NoInfer<Impl<T, Services<D>>>, deps: D, opts?: LayerOptions): Layer<T>
export function layer<T>(tag: TagLike<T>, impl: NoInfer<LayerGenerator<T>>, opts?: LayerOptions): Layer<T>
export function layer<T>(tag: TagLike<T>, impl: NoInfer<Impl<T, []>>, deps?: undefined, opts?: LayerOptions): Layer<T>
export function layer(tag: AnyTag, impl: unknown, depsOrOpts?: readonly AnyTag[] | LayerOptions, maybeOpts: LayerOptions = {}): Layer<unknown> {
  const gen = isGeneratorFunction(impl)
  const depTags = gen || !depsOrOpts ? [] : (depsOrOpts as readonly AnyTag[])
  const opts = (gen ? depsOrOpts : maybeOpts) as LayerOptions | undefined ?? {}
  const key = keyOf(tag)
  const run = async (resolved: readonly unknown[]): Promise<unknown> => {
    if (typeof impl !== 'function') return impl
    if (isClass(impl)) return new (impl as new (...a: unknown[]) => unknown)(...resolved)
    return (impl as (...a: unknown[]) => unknown)(...resolved)
  }
  const make = (resolved: readonly unknown[]): Effect.Effect<unknown, unknown> =>
    gen
      ? runGenerator(key, impl as () => Iterator<unknown, unknown, unknown>)
      : Effect.tryPromise({ try: () => run(resolved), catch: (e) => new LayerFailure(key, e) })
  const requires = depTags.map(coreTag)
  const acquire = Effect.flatMap(
    Effect.all(requires) as unknown as Effect.Effect<readonly unknown[]>,
    (resolved) =>
      make(resolved).pipe(
        Effect.flatMap((r) =>
          isCleanup(r)
            ? Effect.acquireRelease(Effect.succeed(r.service), () =>
                Effect.promise(async () => {
                  try {
                    await r.cleanup()
                  } catch (e) {
                    throw new CleanupFailure(key, e)
                  }
                }))
            : Effect.succeed(r),
        ),
      ),
  )
  const def = declareLayer(EffectLayer.scoped(coreTag(tag), acquire as Effect.Effect<unknown, unknown, never>), {
    attribute: false,
    ...(opts.lifetime && { lifetime: opts.lifetime }),
  })
  const l = Object.freeze({}) as Layer<unknown>
  infos.set(l, { tag, deps: depTags, def })
  defKeys.set(def, key)
  return l
}

/** @internal Kit metadata behind a Layer, or undefined for non-layers. */
export const layerInfo = (x: unknown): LayerInfo | undefined =>
  typeof x === 'object' && x !== null ? infos.get(x) : undefined
