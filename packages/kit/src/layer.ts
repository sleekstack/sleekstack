/**
 * packages/kit/src/layer.ts
 *
 * `layer()` lowers to core `service()`: resolve the deps tuple, then construct
 * (class), call (factory, sync or async) or return (value). A `withCleanup`
 * result lowers to acquireRelease.
 */

import { Effect } from 'effect'
import { service, type AnyServiceDefinition } from '@sleekstack/core'
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
  readonly def: AnyServiceDefinition
}

const infos = new WeakMap<object, LayerInfo>()

/**
 * Implements a Tag. `impl` is constructed (class), called (factory, sync or async), or returned as-is (value),
 * with the services of `deps` passed in order.
 *
 * @param tag - The Tag to implement.
 * @param impl - A class, a factory (may return {@link withCleanup}), or a value.
 * @param deps - Tags resolved and passed to `impl`, in order.
 * @param opts - `lifetime` (default `'app'`).
 * @returns A Layer to list in a module's `provide`.
 * @throws {@link SleekStackError} with code `InvalidTag` when `tag` or a dep is not a `tag()` or named class.
 * @throws {@link SleekStackError} with code `LayerFailed` (when the scope builds) when the factory or constructor throws or rejects.
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
 * ```
 */
export function layer<T, const D extends readonly AnyTag[] = []>(
  tag: TagLike<T>,
  impl: NoInfer<Impl<T, Services<D>>>,
  deps?: D,
  opts: LayerOptions = {},
): Layer<T> {
  const depTags = deps ?? []
  const key = keyOf(tag)
  const run = async (resolved: readonly unknown[]): Promise<unknown> => {
    if (typeof impl !== 'function') return impl
    if (isClass(impl)) return new (impl as new (...a: unknown[]) => unknown)(...resolved)
    return (impl as (...a: unknown[]) => unknown)(...resolved)
  }
  const def = service(
    coreTag(tag),
    { requires: depTags.map(coreTag), ...(opts.lifetime && { lifetime: opts.lifetime }) },
    (resolved) =>
      Effect.tryPromise({ try: () => run(resolved), catch: (e) => new LayerFailure(key, e) }).pipe(
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
  const l = Object.freeze({}) as Layer<T>
  infos.set(l, { tag, deps: depTags, def })
  return l
}

/** @internal Kit metadata behind a Layer, or undefined for non-layers. */
export const layerInfo = (x: unknown): LayerInfo | undefined =>
  typeof x === 'object' && x !== null ? infos.get(x) : undefined
