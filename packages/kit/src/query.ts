/**
 * packages/kit/src/query.ts
 *
 * `cachedQuery()` / `mutation()` lower to TanStack query / mutation options whose function is an `effectFn`
 * (the query bridge). Bodies are generators: each `yield* Tag` resolves from the scope that built the
 * nearest `QueryClient` (the root `LayerProvider`, or a `QueryProvider`), so there is no deps array. Named apart
 * from the server-side `query`/`defineQuery` of `@sleekstack/kit/next`.
 */

import { Effect } from 'effect'
import { hashKey, type QueryFunction, type QueryKey } from '@tanstack/react-query'
import { resolutionFailure } from '@sleekstack/core'
import { effectFn } from '@sleekstack/query'
import { SleekStackError } from './errors'

declare const QueryBrand: unique symbol
declare const MutationBrand: unique symbol

/** A cached server read for one key, created by {@link cachedQuery}; read with `useQuery` from `@sleekstack/kit/react`. */
export interface CachedQuery<T> {
  readonly [QueryBrand]: T
}

/** A write, created by {@link mutation}; run with `useMutation` from `@sleekstack/kit/react`. */
export interface Mutation<I, T> {
  readonly [MutationBrand]: [I, T]
}

/** A generator body: `yield* SomeTag` resolves the service; it returns a value or a Promise. */
export type Body<T> = Generator<unknown, T | Promise<T>, any>

/** Options for {@link cachedQuery}. */
export interface CachedQueryOptions<Args, T> {
  /** A serializable tuple; equal keys share one cache entry. */
  readonly key: (args: Args) => ReadonlyArray<unknown>
  readonly fetch: (args: Args) => Body<T>
  /** Milliseconds a value stays fresh (no refetch on mount or focus). Default 0. */
  readonly staleTime?: number
  /** Milliseconds an unobserved entry is kept. */
  readonly gcTime?: number
  /** Retries after a failed fetch. Default 0. */
  readonly retry?: number
}

/** Options for {@link mutation}. */
export interface MutationOptions<I, T> {
  readonly run: (input: I) => Body<T>
}

/** @internal The TanStack options a kit query lowers to. */
export interface QueryOpts {
  readonly queryKey: QueryKey
  readonly queryFn: QueryFunction
  readonly staleTime?: number
  readonly gcTime?: number
  readonly retry: number
}

const SERVICE_NOT_FOUND = /^Service not found: (.+?)(?: \(defined at|$)/

/** Runs a body as an Effect: thrown errors and rejections become failures, a missing Tag a MissingDependency. */
const lower = <T>(body: () => Body<T>, label: string): Effect.Effect<T, unknown> =>
  Effect.gen(body as () => Generator<never, T | Promise<T>, any>).pipe(
    Effect.flatMap((out) => (out instanceof Promise ? Effect.tryPromise({ try: () => out, catch: (e) => e }) : Effect.succeed(out))),
    Effect.catchAllDefect((e) =>
      Effect.flatMap(Effect.context<never>(), (ctx) => {
        // Only a Tag really absent from the scope is a MissingDependency, not a service throwing that message.
        const key = e instanceof Error ? SERVICE_NOT_FOUND.exec(e.message)?.[1] : undefined
        return Effect.fail(key !== undefined && !ctx.unsafeMap.has(key) ? resolutionFailure(key, label) : e)
      }),
    ),
  )

/** Rejects a key with no stable JSON form (function, BigInt, symbol, cycle). */
const checkKey = (key: ReadonlyArray<unknown>): QueryKey => {
  try {
    JSON.stringify(key, (_, v) => {
      if (typeof v === 'function' || typeof v === 'bigint' || typeof v === 'symbol') throw new TypeError(`unsupported ${typeof v}`)
      return v
    })
  } catch (e) {
    throw new SleekStackError('InvalidQueryKey', `Query key is not serializable: ${e instanceof Error ? e.message : String(e)}`, { key }, { cause: e })
  }
  return key as QueryKey
}

/** @internal The TanStack query options behind a kit query. */
export const queryOpts = (q: CachedQuery<unknown>): QueryOpts => q as unknown as QueryOpts
/** @internal The TanStack mutation function behind a kit mutation. */
export const mutationFn = <I, T>(m: Mutation<I, T>): ((input: I) => Promise<T>) => (m as unknown as { mutationFn: (input: I) => Promise<T> }).mutationFn

/**
 * Defines a cached query: `(args) => CachedQuery`, one entry per `key(args)`. Concurrent reads of a key
 * share one fetch; `staleTime` and `gcTime` control refetching and eviction.
 *
 * @param options - `key`, `fetch` (a generator; `yield*` Tags), `staleTime`, `gcTime`, `retry`.
 * @returns The family; equal keys return the same query.
 * @throws {@link SleekStackError} with code `InvalidQueryKey` (from the returned family) when `key(args)` is not serializable.
 *
 * @example
 * ```ts
 * import { cachedQuery, tag } from '@sleekstack/kit'
 *
 * interface Api { todo(id: string): Promise<string> }
 * const Api = tag<Api>('Api')
 *
 * const todo = cachedQuery({
 *   key: (id: string) => ['todo', id],
 *   fetch: function* (id) {
 *     const api = yield* Api
 *     return api.todo(id)
 *   },
 *   staleTime: 30_000,
 * })
 * ```
 */
export function cachedQuery<Args, T>(options: CachedQueryOptions<Args, T>): (args: Args) => CachedQuery<T> {
  // Weak values: an unreferenced key's options are collected, and a live one keeps its identity.
  const byKey = new Map<string, WeakRef<QueryOpts>>()
  const evict = new FinalizationRegistry<string>((hash) => {
    if (byKey.get(hash)?.deref() === undefined) byKey.delete(hash)
  })
  return (args) => {
    const queryKey = checkKey(options.key(args))
    const hash = hashKey(queryKey)
    let q = byKey.get(hash)?.deref()
    if (!q) {
      q = {
        queryKey,
        queryFn: effectFn(lower(() => options.fetch(args), 'query')),
        retry: options.retry ?? 0,
        ...(options.staleTime !== undefined && { staleTime: options.staleTime }),
        ...(options.gcTime !== undefined && { gcTime: options.gcTime }),
      }
      byKey.set(hash, new WeakRef(q))
      evict.register(q, hash)
    }
    return q as unknown as CachedQuery<T>
  }
}

/**
 * Defines a mutation. Run it with `useMutation`; invalidate affected queries with `useQueryClient`.
 *
 * @param options - `run` (a generator; `yield*` Tags).
 * @returns The mutation.
 *
 * @example
 * ```ts
 * import { mutation, tag } from '@sleekstack/kit'
 *
 * interface Api { rename(id: string, title: string): Promise<void> }
 * const Api = tag<Api>('Api')
 *
 * const rename = mutation({
 *   run: function* (input: { id: string; title: string }) {
 *     const api = yield* Api
 *     return api.rename(input.id, input.title)
 *   },
 * })
 * ```
 */
export function mutation<I, T>(options: MutationOptions<I, T>): Mutation<I, T> {
  // effectFn reads the client from TanStack's (variables, ctx) call, so the input is bound per call.
  const mutationFn = (input: I, ctx: never) => effectFn(lower(() => options.run(input), 'mutation'))(input, ctx)
  return { mutationFn } as unknown as Mutation<I, T>
}
