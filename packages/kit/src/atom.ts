/**
 * packages/kit/src/atom.ts
 *
 * `atom()` lowers to core atoms. A value is a writable atom; a function is an Effect atom that
 * resolves `deps` from the nearest LayerProvider scope, then calls `fn(...services, get)`.
 */

import { Cause, Effect } from 'effect'
import { Atom as CoreAtom, Result } from '@sleekstack/core'
import type { Services } from './layer'
import { coreTag, type AnyTag } from './tag'

declare const AtomBrand: unique symbol
declare const WritableBrand: unique symbol

/** A reactive value read with `useAtomValue` (from `@sleekstack/kit/react`), created by {@link atom}. */
export interface Atom<T> {
  readonly [AtomBrand]: T
}

/** An {@link Atom} created from a plain value; `useAtomSet` writes it. */
export interface WritableAtom<T> extends Atom<T> {
  readonly [WritableBrand]: T
}

/** Reads another atom inside a derived atom's `fn` and recomputes when it changes. */
export type Get = <T>(atom: Atom<T>) => T

/** Options for a derived {@link atom}. */
export interface AtomOptions {
  /** Keep the value after the last reader unmounts (until the provider unmounts). */
  readonly keepAlive?: boolean
}

/** @internal How a kit atom lowers. `async` atoms hold a core `Result`. */
export interface AtomInfo {
  readonly core: CoreAtom.Atom<any>
  readonly async: boolean
}

const infos = new WeakMap<object, AtomInfo>()

/** @internal */
export const infoOf = (a: Atom<unknown>): AtomInfo => infos.get(a)!

const wrap = <A extends Atom<any>>(info: AtomInfo): A => {
  const a = {} as A
  infos.set(a, info)
  return a
}

const PENDING = Symbol('sleekstack.atom.pending')

const getter = (get: CoreAtom.Context): Get => (a) => {
  const { core, async } = infoOf(a)
  const v = get(core)
  if (!async) return v
  const r = v as Result.Result<unknown, unknown>
  if (Result.isInitial(r)) throw PENDING
  if (Result.isFailure(r)) throw Cause.squash(r.cause)
  return r.value as never
}

const isThenable = (x: unknown): x is PromiseLike<unknown> => typeof (x as { then?: unknown } | null)?.then === 'function'

const derived = (fn: (...args: any[]) => unknown, deps: readonly AnyTag[], opts: AtomOptions, prefix: readonly unknown[] = []) => {
  const tags = deps.map(coreTag)
  let core: CoreAtom.Atom<any> = CoreAtom.make((get: CoreAtom.Context) =>
    // Deps resolve synchronously in the forked build, so `fn` (and its `get` calls) runs inside the read.
    Effect.flatMap(Effect.all(tags), (services) => {
      let out: unknown
      try {
        out = fn(...prefix, ...services, getter(get))
      } catch (e) {
        // A dependency is still loading: wait; its completion invalidates and re-runs this build.
        return e === PENDING ? Effect.never : Effect.fail(e)
      }
      return isThenable(out) ? Effect.tryPromise({ try: () => out as PromiseLike<unknown>, catch: (e) => e }) : Effect.succeed(out)
    }),
  )
  if (opts.keepAlive) core = CoreAtom.keepAlive(core)
  return wrap<Atom<unknown>>({ core, async: true })
}

/** Derived: `fn(...services, get)` returns a value or a Promise. */
export function atom<T, const D extends readonly AnyTag[] = []>(
  fn: (...args: [...Services<D>, Get]) => T | Promise<T>,
  deps?: D,
  opts?: AtomOptions,
): Atom<T>
/** Writable state holding `value` initially. */
export function atom<T>(value: T): WritableAtom<T>
/**
 * Creates an atom. A plain value gives writable state. A function gives a derived atom: the services of `deps`
 * are resolved from the nearest `LayerProvider`, like `layer`, and passed to `fn` in order, followed by `get`.
 * Readers suspend until the first value is ready.
 *
 * @param fn - A value, or `fn(...services, get)` returning a value or a Promise.
 * @param deps - Tags resolved and passed to `fn`, in order.
 * @param opts - `keepAlive`.
 * @returns The atom.
 * @throws {@link SleekStackError} with code `InvalidTag` when a dep is not a `tag()` or named class.
 *
 * @example
 * ```ts
 * import { atom, tag } from '@sleekstack/kit'
 *
 * interface Api { user(id: number): Promise<string> }
 * const Api = tag<Api>('Api')
 *
 * const userId = atom(1)
 * const userName = atom((api, get) => api.user(get(userId)), [Api])
 * ```
 */
export function atom(fn: unknown, deps: readonly AnyTag[] = [], opts: AtomOptions = {}): Atom<unknown> {
  if (typeof fn === 'function') return derived(fn as (...a: any[]) => unknown, deps, opts)
  const core: CoreAtom.Writable<unknown, unknown> = CoreAtom.writable(
    () => fn,
    (ctx, v) => ctx.setSelf(typeof v === 'function' ? (v as (p: unknown) => unknown)(ctx.get(core)) : v),
  )
  return wrap({ core, async: false })
}

/**
 * A derived atom per key: `fn(key, ...services, get)`. Equal keys (primitives by value) return the same atom.
 *
 * @param fn - Called with the key, the services of `deps`, then `get`.
 * @param deps - Tags resolved and passed after the key.
 * @returns `(key) => Atom`.
 *
 * @example
 * ```ts
 * import { atom, tag } from '@sleekstack/kit'
 *
 * interface Api { user(id: number): Promise<string> }
 * const Api = tag<Api>('Api')
 * const userName = atom.family((id: number, api) => api.user(id), [Api])
 * userName(1) === userName(1) // true
 * ```
 */
atom.family = <K, T, const D extends readonly AnyTag[] = []>(
  fn: (key: K, ...args: [...Services<D>, Get]) => T | Promise<T>,
  deps?: D,
): ((key: K) => Atom<T>) =>
  CoreAtom.family((key: K) => derived(fn as (...a: any[]) => unknown, deps ?? [], {}, [key]) as Atom<T>)
