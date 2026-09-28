/**
 * packages/core/src/atom/Atom.ts
 *
 * Atom definitions, modeled on effect-atom@0.6.0 Atom.ts. An atom is a lazy recipe;
 * its state lives in an AtomStore.
 */

import { Cause, Effect, Equal, Exit, Hash, Option, Stream } from 'effect'
import * as Result from './Result'

/** Brand carried by every atom. */
export const TypeId: unique symbol = Symbol.for('@sleekstack/core/Atom') as never
/** Type of {@link TypeId}. */
export type TypeId = typeof TypeId

/** The read context handed to `read`: call it (`get(other)`) to read another atom and depend on it. */
export interface Context {
  /** Reads `atom` and records it as a dependency. */
  <A>(atom: Atom<A>): A
  /** Same as calling the context. */
  readonly get: <A>(atom: Atom<A>) => A
  /** The node's current value, when it has one. */
  readonly self: <A>() => A | undefined
  /** Replaces the node's own value (used by async atoms). */
  readonly setSelf: <A>(value: A) => void
  /** Re-runs another atom. */
  readonly refresh: (atom: Atom<any>) => void
  /** Re-runs this atom. */
  readonly refreshSelf: () => void
  /** Registers a callback run when this build is invalidated or removed. */
  readonly addFinalizer: (finalizer: () => void) => void
}

/** The context handed to a writable atom's `write`. */
export interface WriteContext<A> {
  /** Reads an atom (no dependency is recorded). */
  readonly get: <T>(atom: Atom<T>) => T
  /** Writes another writable atom. */
  readonly set: <R, W>(atom: Writable<R, W>, value: W) => void
  /** Replaces this atom's value. */
  readonly setSelf: (value: A) => void
  /** Re-runs this atom. */
  readonly refreshSelf: () => void
}

/** @internal Build context the store passes to reads: adds the store's Effect runner. */
export interface BuildContext extends Context {
  /** Forks `effect` on a fresh Scope for this build; returns the Exit when it completed synchronously. */
  readonly fork: <A, E>(effect: Effect.Effect<A, E, any>, onExit: (exit: Exit.Exit<A, E>) => void) => Exit.Exit<A, E> | undefined
}

/** A lazy, keyed node definition. */
export interface Atom<A> {
  readonly [TypeId]: TypeId
  /** Name used in errors (e.g. `AtomCycle`). */
  readonly label: string
  /** When true, the store never removes the node. */
  readonly keepAlive: boolean
  /** Per-atom idle time (ms) before an unused node is removed; overrides the store default. */
  readonly idleTTL?: number
  /** Computes the value; `get(other)` records dependencies. */
  readonly read: (get: Context) => A
}

/** An atom that can be written. */
export interface Writable<R, W = R> extends Atom<R> {
  /** Handles `store.set(atom, value)`. */
  readonly write: (ctx: WriteContext<R>, value: W) => void
}

let counter = 0

const makeAtom = <A>(read: (get: Context) => A, write?: (ctx: WriteContext<A>, value: any) => void): any => ({
  [TypeId]: TypeId,
  label: `atom#${++counter}`,
  keepAlive: false,
  read,
  ...(write ? { write } : {}),
})

/** True when `u` is an atom. */
export const isAtom = (u: unknown): u is Atom<unknown> => typeof u === 'object' && u !== null && TypeId in u

/** True when `atom` is writable. */
export const isWritable = <A>(atom: Atom<A>): atom is Writable<A, unknown> => 'write' in atom

const isStream = (u: unknown): u is Stream.Stream<unknown, unknown, unknown> =>
  typeof u === 'object' && u !== null && Stream.StreamTypeId in u

const fromExit = <A, E>(exit: Exit.Exit<A, E>, previous: Result.Result<A, E> | undefined): Result.Result<A, E> =>
  Exit.isSuccess(exit)
    ? Result.success(exit.value)
    : Result.failure(exit.cause, { previousValue: previous ? Result.value(previous) : Option.none() })

const runEffect = <A, E>(get: Context, effect: Effect.Effect<A, E, any>): Result.Result<A, E> => {
  const previous = get.self<Result.Result<A, E>>()
  const exit = (get as BuildContext).fork(effect, (exit) => get.setSelf(fromExit(exit, previous)))
  return exit ? fromExit(exit, previous) : Result.waitingFrom(previous)
}

const runStream = <A, E>(get: Context, stream: Stream.Stream<A, E, any>): Result.Result<A, E> => {
  const previous = get.self<Result.Result<A, E>>()
  let last = Option.none<A>()
  let building = true
  const done = (exit: Exit.Exit<void, E>): Result.Result<A, E> =>
    Exit.isFailure(exit)
      ? Result.failure(exit.cause, { previousValue: Option.orElse(last, () => (previous ? Result.value(previous) : Option.none())) })
      : Option.isSome(last)
        ? Result.success(last.value)
        : Result.failure(Cause.fail(new Cause.NoSuchElementException()) as Cause.Cause<never>)
  const exit = (get as BuildContext).fork(
    Stream.runForEach(stream, (a) =>
      Effect.sync(() => {
        last = Option.some(a)
        if (!building) get.setSelf(Result.success(a, { waiting: true }))
      }),
    ),
    (exit) => get.setSelf(done(exit)),
  )
  building = false
  if (exit) return done(exit)
  return Option.isSome(last) ? Result.success(last.value, { waiting: true }) : Result.waitingFrom(previous)
}

const readResult = (get: Context, u: unknown): unknown =>
  Effect.isEffect(u) ? runEffect(get, u) : isStream(u) ? runStream(get, u) : u

/** An Effect atom: runs the Effect per build; its value is a `Result`. */
export function make<A, E, R>(effect: Effect.Effect<A, E, R>): Atom<Result.Result<A, E>>
/** A Stream atom: its value is the latest element as a `Result`. */
export function make<A, E, R>(stream: Stream.Stream<A, E, R>): Atom<Result.Result<A, E>>
/** A derived Effect atom. */
export function make<A, E, R>(read: (get: Context) => Effect.Effect<A, E, R>): Atom<Result.Result<A, E>>
/** A derived Stream atom. */
export function make<A, E, R>(read: (get: Context) => Stream.Stream<A, E, R>): Atom<Result.Result<A, E>>
/** A derived atom, recomputed when a dependency changes. */
export function make<A>(read: (get: Context) => A): Atom<A>
/** Writable state holding `value` initially. */
export function make<A>(value: A): Writable<A>
export function make(arg: unknown): Atom<unknown> {
  if (typeof arg === 'function') return makeAtom((get) => readResult(get, (arg as (get: Context) => unknown)(get)))
  if (Effect.isEffect(arg) || isStream(arg)) return makeAtom((get) => readResult(get, arg))
  return makeAtom(
    () => arg,
    (ctx, value) => ctx.setSelf(value),
  )
}

/** A writable atom from a `read` and a `write`. */
export const writable = <R, W = R>(read: (get: Context) => R, write: (ctx: WriteContext<R>, value: W) => void): Writable<R, W> =>
  makeAtom(read, write)

/** A copy of `self` that the store never removes. */
export const keepAlive = <T extends Atom<any>>(self: T): T => ({ ...self, keepAlive: true })

/** A copy of `self` removed `ms` after it becomes unused. */
export const setIdleTTL = <T extends Atom<any>>(self: T, ms: number): T => ({ ...self, idleTTL: ms })

/**
 * Memoizes `f` per structural key (`Equal`/`Hash`; primitives by value). Atoms are held
 * through `WeakRef` + `FinalizationRegistry`; where those are missing, a plain Map is used
 * and never evicts. Nested families are not supported for GC.
 */
export const family = <Arg, T extends object>(f: (arg: Arg) => T): ((arg: Arg) => T) => {
  const weak = typeof WeakRef !== 'undefined' && typeof FinalizationRegistry !== 'undefined'
  const buckets = new Map<number, Array<{ key: Arg; ref: { deref(): T | undefined } }>>()
  const registry = weak
    ? new FinalizationRegistry<number>((hash) => {
        const bucket = buckets.get(hash)?.filter((e) => e.ref.deref() !== undefined)
        if (bucket?.length) buckets.set(hash, bucket)
        else buckets.delete(hash)
      })
    : undefined
  return (arg) => {
    const hash = Hash.hash(arg)
    const bucket = buckets.get(hash) ?? []
    for (const entry of bucket) {
      const found = entry.ref.deref()
      if (found !== undefined && Equal.equals(entry.key, arg)) return found
    }
    const atom = f(arg)
    bucket.push({ key: arg, ref: registry ? new WeakRef(atom) : { deref: () => atom } })
    buckets.set(hash, bucket)
    registry?.register(atom, hash)
    return atom
  }
}
