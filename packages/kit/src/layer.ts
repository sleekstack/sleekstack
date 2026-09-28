/**
 * packages/kit/src/layer.ts
 *
 * `layer()` lowers to core `service()`: resolve the deps tuple, then construct
 * (class), call (factory, sync or async) or return (value). A `withCleanup`
 * result lowers to acquireRelease.
 */

import { Effect } from 'effect'
import { service, type AnyServiceDefinition } from '@sleekstack/core'
import { LayerFailure } from './errors'
import { coreTag, keyOf, type AnyTag, type ServiceOf, type TagLike } from './tag'

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

export interface LayerOptions {
  readonly lifetime?: Lifetime
}

/** Resolved services for a deps tuple, in order. */
export type Services<D extends readonly AnyTag[]> = { -readonly [K in keyof D]: ServiceOf<D[K]> }

type NonCallable<T> = T extends (...args: any) => any ? never : T extends abstract new (...args: any) => any ? never : T

export type Impl<T, A extends readonly unknown[]> =
  | (new (...args: A) => T)
  | ((...args: A) => T | Cleanup<T> | Promise<T | Cleanup<T>>)
  | NonCallable<T>

const CLEANUP = Symbol('sleekstack.cleanup')
type CleanupBox = { readonly [CLEANUP]: true; readonly service: unknown; readonly cleanup: () => unknown }

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
            ? Effect.acquireRelease(Effect.succeed(r.service), () => Effect.promise(async () => { await r.cleanup() }))
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
