/**
 * packages/kit/src/tag.ts
 *
 * Kit Tags: `tag<T>(name)` objects and abstract classes. `tag()`'s value is the real Effect
 * `Context.Tag` itself (R9 prototype: `effect`, `packages/kit/src/next/action.ts`), so
 * `yield* SomeTag` resolves it directly inside a generator — no Effect import needed at the call
 * site. Held in a module-level WeakMap regardless, so `coreTag()` stays one lookup for both this
 * and the abstract-class branch.
 */

import { Context } from 'effect'
import { SleekStackError } from './errors'

declare const TagBrand: unique symbol

/**
 * A service token created by `tag<T>(name)`. Directly yieldable: `yield* SomeTag` resolves `T`.
 *
 * This interface is deliberately self-referential instead of `extends Effect.Effect<T, never, T>`:
 * TypeScript's `yield*` only needs a matching `[Symbol.iterator]` shape, not the real Effect type —
 * and the real one carries a property keyed by Effect's own `EffectTypeId` (a `unique symbol`
 * declared in `effect`), which R7 (`__tests__/dts.test.ts`) forbids from reaching kit's public
 * types. The runtime value is still the real `Context.Tag` (see `tag()` below); only its declared
 * type here is narrower.
 */
export interface Tag<T> {
  readonly key: string
  readonly [TagBrand]: T
  [Symbol.iterator](): Generator<Tag<T>, T, unknown>
}

/** Anything accepted as a Tag: a `tag()` token or an (abstract) class. */
export type TagLike<T> = Tag<T> | (abstract new (...args: any) => T)

export type AnyTag = TagLike<any>

/** The service type a Tag stands for. */
export type ServiceOf<X> = X extends Tag<infer T> ? T : X extends abstract new (...args: any) => infer T ? T : never

const cores = new WeakMap<object, Context.Tag<any, any>>()

/**
 * Creates a service token. Two `tag()` calls make two distinct Tags, even with the same name.
 *
 * The returned value is the real Effect `Context.Tag` itself (prototype: R9's `effect`),
 * so `yield* SomeTag` inside a generator resolves it directly against whatever Context is
 * provided — no Effect import needed at the call site, since the value was already Effect-shaped.
 *
 * @param name - The Tag's key, shown in errors and the graph snapshot.
 * @returns A frozen Tag for `T`.
 * @throws {@link SleekStackError} with code `InvalidTag` when `name` is empty or not a string.
 *
 * @example
 * ```ts
 * import { tag } from '@sleekstack/kit'
 *
 * interface Clock { now(): number }
 * export const Clock = tag<Clock>('Clock')
 * ```
 */
export function tag<T>(name: string): Tag<T> {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new SleekStackError('InvalidTag', `tag(): name must be a non-empty string, got: ${JSON.stringify(name)}`)
  }
  const t = Object.freeze(Context.GenericTag<T>(name)) as unknown as Tag<T>
  cores.set(t, t as unknown as Context.Tag<any, any>)
  return t
}

/** @internal The Tag's key (class name for abstract classes). */
export const keyOf = (t: AnyTag): string => (typeof t === 'function' ? t.name : t.key)

/** @internal The core Tag behind a kit Tag; an abstract class gets one on first use. */
export function coreTag(t: AnyTag): Context.Tag<any, any> {
  const found = cores.get(t)
  if (found) return found
  if (typeof t === 'function' && t.name) {
    const made = Context.GenericTag<unknown>(t.name)
    cores.set(t, made)
    return made
  }
  throw new SleekStackError('InvalidTag', `Expected a tag() or a named class, got: ${String(t)}`)
}
