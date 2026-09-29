/**
 * packages/kit/src/next/action.ts
 *
 * `effect`/`query` run once, immediately (`defineEffect`/`defineQuery` are the reusable, directly callable forms): resolve the `deps`, open a request scope Shadowed by
 * `opts.provide`, run the generator, close the scope, settle. Next's `'use server'` transform only
 * recognizes a literal `async function` export, so call them from inside one. next's internal
 * `onExit` hook (ADR 0009) hands back the Exit, mapped once to an ActionResult or a rejection.
 */

import { resolveTagEffect } from '@sleekstack/core'
import { action as nextAction, query as nextQuery } from '@sleekstack/next'
import { Cause, Context, Effect, Exit } from 'effect'
import { normalize, SleekStackError } from '../errors'
import type { Layer } from '../layer'
import { unwrap, validateProvide, type Module } from '../module'
import { coreTag, type AnyTag } from '../tag'

/** What an {@link effect} resolves to: `{ ok: true, data }`, or `{ ok: false, error }` after {@link fail}. */
export type ActionResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string }

/** Per-operation options for {@link effect} and {@link query}. */
export interface OperationOptions {
  /**
   * Built in the request scope, Shadowing the runtime graph for this call only. A thunk
   * reads per-request state (e.g. a cookie) fresh on every call.
   */
  readonly provide?: ReadonlyArray<Layer<any> | Module> | (() => Promise<ReadonlyArray<Layer<any> | Module>>)
}

class Failure {
  constructor(readonly message: string) {}
}

/**
 * Ends the handler with an expected failure: `{ ok: false, error: message }` from an action, a rejection from a query.
 *
 * @param message - The user-facing failure message.
 * @returns Never; it throws.
 *
 * @example
 * ```ts
 * import { effect, fail } from '@sleekstack/kit/next'
 *
 * export async function rename(name: string) {
 *   return effect(function* () {
 *     return name ? name.trim() : fail('Name is required')
 *   }, [])
 * }
 * ```
 */
export function fail(message: string): never {
  throw new Failure(message)
}

async function run<D extends readonly AnyTag[]>(
  op: typeof nextAction,
  factory: (...deps: any[]) => unknown,
  deps: D,
  opts: OperationOptions,
): Promise<ActionResult<unknown>> {
  const onExit = (exit: Exit.Exit<unknown, unknown>): ActionResult<unknown> => {
    if (Exit.isSuccess(exit)) return { ok: true, data: exit.value }
    const e = Cause.squash(exit.cause)
    if (e instanceof Failure) return { ok: false, error: e.message }
    throw normalize(e)
  }
  const fn = () =>
    Effect.gen(function* () {
      const resolved = yield* Effect.all(deps.map((t) => resolveTagEffect(coreTag(t), 'action'))).pipe(Effect.mapError((e) => normalize(e)))
      return yield* Effect.tryPromise({
        try: async () => factory(...resolved),
        catch: (e) => (e instanceof Failure ? e : normalize(e, 'HandlerFailed')),
      })
    })
  // Not normalized: Next's dynamic-rendering bailouts (e.g. from `cookies()`) must reach Next as thrown.
  const raw = typeof opts.provide === 'function' ? await opts.provide() : (opts.provide ?? [])
  let provide: never
  try {
    validateProvide(raw)
    // next types `provide` as Entry[], but its request scope (core `child`) accepts modules too;
    // passing core modules keeps their privacy and local-over-import Shadowing.
    provide = unwrap(raw) as never
  } catch (e) {
    throw normalize(e)
  }
  const invoke = op({ provide, onExit }, fn) as unknown as () => Promise<ActionResult<unknown>>
  try {
    return await invoke()
  } catch (e) {
    throw normalize(e)
  }
}

type Gen<R> = Generator<unknown, R, any>

async function runGen<R>(
  op: typeof nextAction,
  impl: () => Gen<R>,
  deps: readonly AnyTag[],
  opts: OperationOptions,
): Promise<ActionResult<Awaited<R>>> {
  // The generator runs against a Context built from *only* its declared deps, so `yield*`-ing
  // anything else fails like a missing dependency instead of reaching the ambient graph.
  const factory = async (...resolved: unknown[]) => {
    const context = Context.unsafeMake(new Map(deps.map((t, i) => [coreTag(t).key, resolved[i]] as const))) as Context.Context<never>
    const inner = Effect.gen(() => impl() as never) as Effect.Effect<R, unknown, never>
    const exit = await Effect.runPromiseExit(Effect.mapInputContext(inner, () => context))
    if (Exit.isSuccess(exit)) return exit.value
    throw Cause.squash(exit.cause)
  }
  return (await run(op, factory, deps, opts)) as ActionResult<Awaited<R>>
}

const unwrapQuery = async <R>(r: Promise<ActionResult<R>>): Promise<R> => {
  const x = await r
  if (!x.ok) throw new Error(x.error)
  return x.data
}

/**
 * Defines a reusable Server Action body: a generator plus the Tags it may `yield*`. The result is
 * directly callable with the body's own arguments; each call runs in a fresh request scope and
 * settles as an {@link ActionResult}. Expected failures use {@link fail}. `.deps` exposes the
 * declared Tags. A `const` isn't something Next's `'use server'` transform recognizes, so export a
 * literal `async function` that calls it (or use {@link effect} inline).
 *
 * @example
 * ```ts
 * import { tag } from '@sleekstack/kit'
 * import { defineEffect } from '@sleekstack/kit/next'
 *
 * interface Todos { add(title: string): { id: number } }
 * const Todos = tag<Todos>('Todos')
 *
 * const addTodoEffect = defineEffect(function* (title: string) {
 *   const todos = yield* Todos
 *   return todos.add(title)
 * }, [Todos])
 *
 * export async function addTodo(title: string) {
 *   return addTodoEffect(title)
 * }
 * ```
 */
export function defineEffect<const D extends readonly AnyTag[], A extends readonly unknown[], R>(
  impl: (...args: A) => Gen<R>,
  deps: D,
  opts: OperationOptions = {},
): ((...args: A) => Promise<ActionResult<Awaited<R>>>) & { readonly deps: D } {
  return Object.assign((...args: A) => runGen(nextAction, () => impl(...args), deps, opts), { deps })
}

/** Like {@link defineEffect}, for a read: the call resolves the plain value and a {@link fail} rejects with its message. */
export function defineQuery<const D extends readonly AnyTag[], A extends readonly unknown[], R>(
  impl: (...args: A) => Gen<R>,
  deps: D,
  opts: OperationOptions = {},
): ((...args: A) => Promise<Awaited<R>>) & { readonly deps: D } {
  return Object.assign((...args: A) => unwrapQuery(runGen(nextQuery, () => impl(...args), deps, opts)), { deps })
}

/**
 * Runs a generator now, in a fresh request scope, and settles as an {@link ActionResult}: the
 * one-shot form of {@link defineEffect}, for a literal `'use server'` export that closes over its own arguments.
 *
 * @throws {@link SleekStackError} with code `DuplicateTag` when `opts.provide` holds two Tags with one key.
 * @throws {@link SleekStackError} with code `MissingDependency` or `PrivateDependency` when a dep is not visible.
 * @throws {@link SleekStackError} with code `HandlerFailed` when the body throws (other than {@link fail}).
 * @throws {@link SleekStackError} with code `LayerFailed` when a request-scope Layer fails to build, or `Unknown` when the runtime is not configured.
 */
export function effect<const D extends readonly AnyTag[], R>(impl: () => Gen<R>, deps: D, opts: OperationOptions = {}): Promise<ActionResult<Awaited<R>>> {
  return runGen(nextAction, impl, deps, opts)
}

/** Runs a generator now like {@link effect}, but resolves the plain value; a {@link fail} rejects with its message. */
export function query<const D extends readonly AnyTag[], R>(impl: () => Gen<R>, deps: D, opts: OperationOptions = {}): Promise<Awaited<R>> {
  return unwrapQuery(runGen(nextQuery, impl, deps, opts))
}
