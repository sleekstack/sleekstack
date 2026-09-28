/**
 * packages/kit/src/next/action.ts
 *
 * Kit `action`/`query` lower to next's. The delegated Effect checks and resolves
 * the deps from the request context, runs the handler, and returns the raw value
 * (so next's stream guard sees it). `fail()` and other failures come back as
 * branded sentinels, which the outer wrapper maps after next resolves.
 */

import { privateDependencyOf } from '@sleekstack/core'
import { action as nextAction, query as nextQuery } from '@sleekstack/next'
import { Context, Effect, Option } from 'effect'
import { normalize, SleekStackError } from '../errors'
import type { Layer } from '../layer'
import { unwrap, validateProvide, type Module } from '../module'
import { coreTag, keyOf, type AnyTag } from '../tag'
import type { Services } from '../layer'

/** What an {@link action} resolves to: `{ ok: true, data }`, or `{ ok: false, error }` after {@link fail}. */
export type ActionResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string }

/** Per-operation options for {@link action} and {@link query}. */
export interface OperationOptions {
  /** Built in the request scope, shadowing the runtime graph for this call only. */
  readonly provide?: ReadonlyArray<Layer<any> | Module>
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
 * import { action, fail } from '@sleekstack/kit/next'
 *
 * export const rename = action(() => (name: string) => (name ? name.trim() : fail('Name is required')), [])
 * ```
 */
export function fail(message: string): never {
  throw new Failure(message)
}

const FAILED = Symbol('sleekstack.failed')
const ERRORED = Symbol('sleekstack.errored')
type Sentinel = { readonly [FAILED]: string } | { readonly [ERRORED]: SleekStackError }

const isObj = (v: unknown): v is Record<PropertyKey, unknown> => typeof v === 'object' && v !== null

function lower<D extends readonly AnyTag[], A extends unknown[]>(
  op: typeof nextAction,
  factory: (...deps: any[]) => (...args: A) => unknown,
  deps: D,
  opts: OperationOptions,
) {
  let provide
  try {
    validateProvide(opts.provide ?? [])
    // next types `provide` as Entry[], but its request scope (core `child`) accepts modules too;
    // passing core modules keeps their privacy and local-over-import Shadowing.
    provide = unwrap(opts.provide ?? []) as never
  } catch (e) {
    throw normalize(e)
  }
  const run = op({ provide }, (...args: A) =>
    Effect.gen(function* () {
      const resolved: unknown[] = []
      for (const t of deps) {
        const found = yield* Effect.serviceOption(coreTag(t))
        if (Option.isNone(found)) {
          const key = keyOf(t)
          const hidden = privateDependencyOf((yield* Effect.context<never>()) as Context.Context<any>, key, 'action')
          if (hidden) return { [ERRORED]: normalize(hidden) } as Sentinel
          return { [ERRORED]: new SleekStackError('MissingDependency', `Action dependency "${key}" is not provided`, { tag: key }) } as Sentinel
        }
        resolved.push(found.value)
      }
      return yield* Effect.tryPromise({ try: async () => factory(...resolved)(...args), catch: (e) => e })
    }).pipe(
      Effect.catchAll((e): Effect.Effect<unknown> =>
        Effect.succeed(e instanceof Failure ? { [FAILED]: e.message } : { [ERRORED]: normalize(e, 'HandlerFailed') }),
      ),
    ),
  )
  return async (...args: A): Promise<ActionResult<unknown>> => {
    let value: unknown
    try {
      value = await run(...args)
    } catch (e) {
      const inner = (e as { cause?: unknown })?.cause
      throw normalize(inner !== undefined && !(e instanceof SleekStackError) ? inner : e)
    }
    if (isObj(value) && ERRORED in value) throw value[ERRORED]
    if (isObj(value) && FAILED in value) return { ok: false, error: value[FAILED] as string }
    return { ok: true, data: value }
  }
}

/**
 * A Server Action: `factory` gets the resolved deps and returns the handler. Each call runs in its own request scope.
 *
 * @param factory - Receives `deps`' services in order; returns the handler.
 * @param deps - Tags resolved from the request scope.
 * @param opts - `provide`: Layers/modules built in this call's request scope only.
 * @returns An async function resolving an {@link ActionResult}.
 * @throws {@link SleekStackError} with code `DuplicateTag` (at definition) when `opts.provide` holds two Tags with one key.
 * @throws {@link SleekStackError} (rejection) with code `MissingDependency` or `PrivateDependency` when a dep is not visible.
 * @throws {@link SleekStackError} (rejection) with code `HandlerFailed` when the handler throws (other than {@link fail}).
 * @throws {@link SleekStackError} (rejection) with code `LayerFailed` when a request-scope Layer fails to build, or `Unknown` when the runtime is not configured.
 *
 * @example
 * ```ts
 * import { tag } from '@sleekstack/kit'
 * import { action } from '@sleekstack/kit/next'
 *
 * interface Todos { add(title: string): Promise<{ id: number }> }
 * const Todos = tag<Todos>('Todos')
 *
 * export const addTodo = action((todos) => (title: string) => todos.add(title), [Todos])
 * ```
 */
export function action<const D extends readonly AnyTag[], A extends unknown[], R>(
  factory: (...deps: Services<D>) => (...args: A) => R,
  deps: D,
  opts: OperationOptions = {},
): (...args: A) => Promise<ActionResult<Awaited<R>>> {
  const run = lower(nextAction, factory as never, deps, opts)
  return async (...args: A) => (await run(...args)) as ActionResult<Awaited<R>>
}

/**
 * Like {@link action}, but resolves the plain value; a {@link fail} rejects with its message.
 *
 * @param factory - Receives `deps`' services in order; returns the handler.
 * @param deps - Tags resolved from the request scope.
 * @param opts - `provide`: Layers/modules built in this call's request scope only.
 * @returns An async function resolving the handler's value.
 * @throws `Error` (rejection) with the {@link fail} message.
 * @throws {@link SleekStackError} with the same codes as {@link action}.
 *
 * @example
 * ```ts
 * import { tag } from '@sleekstack/kit'
 * import { query } from '@sleekstack/kit/next'
 *
 * interface Todos { list(): Promise<string[]> }
 * const Todos = tag<Todos>('Todos')
 *
 * export const listTodos = query((todos) => () => todos.list(), [Todos])
 * ```
 */
export function query<const D extends readonly AnyTag[], A extends unknown[], R>(
  factory: (...deps: Services<D>) => (...args: A) => R,
  deps: D,
  opts: OperationOptions = {},
): (...args: A) => Promise<Awaited<R>> {
  const run = lower(nextQuery, factory as never, deps, opts)
  return (async (...args: A) => {
    const r = await run(...args)
    if (!r.ok) throw new Error(r.error)
    return r.data as Awaited<R>
  }) as (...args: A) => Promise<Awaited<R>>
}
