/**
 * packages/kit/src/next/action.ts
 *
 * Kit `action`/`query` lower to next's. The delegated Effect checks and resolves
 * the deps from the request context, runs the handler, and returns the raw value
 * (so next's stream guard sees it). `fail()` and other failures come back as
 * branded sentinels, which the outer wrapper maps after next resolves.
 */

import { action as nextAction, query as nextQuery } from '@sleekstack/next'
import { Effect, Option } from 'effect'
import { normalize, SleekStackError } from '../errors'
import type { Layer } from '../layer'
import { flatEntries, validateProvide, type Module } from '../module'
import { coreTag, keyOf, type AnyTag } from '../tag'
import type { Services } from '../layer'

export type ActionResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string }

export interface OperationOptions {
  /** Built in the request scope, shadowing the runtime graph for this call only. */
  readonly provide?: ReadonlyArray<Layer<any> | Module>
}

class Failure {
  constructor(readonly message: string) {}
}

/** Ends the handler with an expected failure: `{ok:false,error:message}` from an action, a rejection from a query. */
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
    provide = flatEntries(opts.provide ?? [])
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
      throw normalize((e as { cause?: unknown })?.cause ?? e)
    }
    if (isObj(value) && ERRORED in value) throw value[ERRORED]
    if (isObj(value) && FAILED in value) return { ok: false, error: value[FAILED] as string }
    return { ok: true, data: value }
  }
}

/** A Server Action: `factory` gets the resolved deps and returns the handler. Resolves an `ActionResult`. */
export function action<const D extends readonly AnyTag[], A extends unknown[], R>(
  factory: (...deps: Services<D>) => (...args: A) => R,
  deps: D,
  opts: OperationOptions = {},
): (...args: A) => Promise<ActionResult<Awaited<R>>> {
  const run = lower(nextAction, factory as never, deps, opts)
  return async (...args: A) => (await run(...args)) as ActionResult<Awaited<R>>
}

/** Like `action`, but resolves the plain value; a `fail()` rejects with its message. */
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
