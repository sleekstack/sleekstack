/**
 * packages/kit/src/next/action.ts
 *
 * `effect`/`query` run once, immediately (`defineEffect`/`defineQuery` are the reusable, directly callable forms): open a request scope Shadowed by
 * `opts.provide`, run the generator (resolving each `yield*` Tag on demand, plus `opts.scope` up front), close the scope, settle. Next's `'use server'` transform only
 * recognizes a literal `async function` export, so call them from inside one. next's internal
 * `onExit` hook (ADR 0009) hands back the Exit, mapped once to an ActionResult or a rejection.
 */

import { resolutionFailure, resolveTagEffect } from '@sleekstack/core'
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
  /**
   * Tags resolved before the body runs though it never `yield*`s them, for their side effects
   * (e.g. `RequestContext`, whose request-scoped layer logs open / close).
   */
  readonly scope?: readonly AnyTag[]
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
 *   })
 * }
 * ```
 */
export function fail(message: string): never {
  throw new Failure(message)
}

async function run(
  op: typeof nextAction,
  factory: (context: Context.Context<any>) => unknown,
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
      yield* Effect.all((opts.scope ?? []).map((t) => resolveTagEffect(coreTag(t), 'action'))).pipe(Effect.mapError((e) => normalize(e)))
      const context = (yield* Effect.context<never>()) as Context.Context<any>
      return yield* Effect.tryPromise({
        try: async () => factory(context),
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

async function runGen<R>(op: typeof nextAction, impl: () => Gen<R>, opts: OperationOptions): Promise<ActionResult<Awaited<R>>> {
  // `yield* Tag` reads the request scope's public Context on demand. Effect's own miss is an
  // untyped "Service not found" defect, so the last missed key is remembered and mapped to
  // MissingDependency / PrivateDependency. Build-time isolation is the analyzer's job (fn-9).
  const factory = async (scope: Context.Context<any>) => {
    let missed: string | undefined
    const map = new (class extends Map<string, unknown> {
      override has(key: string) {
        const hit = super.has(key)
        if (!hit) missed = key
        return hit
      }
    })(scope.unsafeMap)
    const context = Context.unsafeMake(map) as Context.Context<never>
    const inner = Effect.gen(() => impl() as never) as Effect.Effect<R, unknown, never>
    const exit = await Effect.runPromiseExit(Effect.mapInputContext(inner, () => context))
    if (Exit.isSuccess(exit)) return exit.value
    const e = Cause.squash(exit.cause)
    if (missed !== undefined && e instanceof Error && e.message.startsWith('Service not found')) throw resolutionFailure(scope, missed, 'action')
    throw e
  }
  return (await run(op, factory, opts)) as ActionResult<Awaited<R>>
}

const unwrapQuery = async <R>(r: Promise<ActionResult<R>>): Promise<R> => {
  const x = await r
  if (!x.ok) throw new Error(x.error)
  return x.data
}

/**
 * Defines a reusable Server Action body: a generator whose `yield*`ed Tags resolve from the request scope. The result is
 * directly callable with the body's own arguments; each call runs in a fresh request scope and
 * settles as an {@link ActionResult}. Expected failures use {@link fail}. A `const` isn't something Next's `'use server'` transform recognizes, so export a
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
 * })
 *
 * export async function addTodo(title: string) {
 *   return addTodoEffect(title)
 * }
 * ```
 */
export function defineEffect<A extends readonly unknown[], R>(
  impl: (...args: A) => Gen<R>,
  opts: OperationOptions = {},
): (...args: A) => Promise<ActionResult<Awaited<R>>> {
  return (...args: A) => runGen(nextAction, () => impl(...args), opts)
}

/** Like {@link defineEffect}, for a read: the call resolves the plain value and a {@link fail} rejects with its message. */
export function defineQuery<A extends readonly unknown[], R>(impl: (...args: A) => Gen<R>, opts: OperationOptions = {}): (...args: A) => Promise<Awaited<R>> {
  return (...args: A) => unwrapQuery(runGen(nextQuery, () => impl(...args), opts))
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
export function effect<R>(impl: () => Gen<R>, opts: OperationOptions = {}): Promise<ActionResult<Awaited<R>>> {
  return runGen(nextAction, impl, opts)
}

/** Runs a generator now like {@link effect}, but resolves the plain value; a {@link fail} rejects with its message. */
export function query<R>(impl: () => Gen<R>, opts: OperationOptions = {}): Promise<Awaited<R>> {
  return unwrapQuery(runGen(nextQuery, impl, opts))
}
