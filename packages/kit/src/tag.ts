/**
 * packages/kit/src/tag.ts
 *
 * Kit Tags: `tag<T>(name)` objects and abstract classes. Both map to a core
 * (Effect) Tag keyed by name, held in a module-level WeakMap so no Effect type
 * reaches the public surface.
 */

import { Context } from 'effect'
import { SleekStackError } from './errors'

declare const TagBrand: unique symbol

/** A service token created by `tag<T>(name)`. */
export interface Tag<T> {
  readonly key: string
  readonly [TagBrand]: T
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
  const t = Object.freeze({ key: name }) as Tag<T>
  cores.set(t, Context.GenericTag<T>(name))
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
