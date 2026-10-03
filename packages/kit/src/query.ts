/**
 * packages/kit/src/query.ts
 *
 * `cachedQuery()` / `mutation()` lower to the query package. Bodies are generators: each `yield* Tag` resolves
 * from the nearest LayerProvider scope, so there is no deps array. Named apart from the server-side
 * `query`/`defineQuery` of `@sleekstack/kit/next`.
 */

import { Effect, ParseResult, Schedule, Schema } from 'effect'
import { resolutionFailure } from '@sleekstack/core'
import { normalize, SleekStackError } from './errors'
import { Hydrate, Mutation as CoreMutation, Query as CoreQuery } from '@sleekstack/query'

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

/** How a `serializable` query's value crosses the server-to-client wire: `encode` to JSON values, `decode` back. */
export interface QueryCodec<T> {
  readonly encode: (value: T) => unknown
  readonly decode: (raw: unknown) => T
}

declare const DehydratedBrand: unique symbol
/** Serializable query state from `prefetch` (`@sleekstack/kit/next`), handed to `<HydrateQueries state>`. */
export interface Dehydrated extends ReadonlyArray<unknown> {
  readonly [DehydratedBrand]: true
}

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
  /** Opts the query in to SSR `prefetch`/`HydrateQueries`: `true` sends the value as is (it must be JSON-safe), or a {@link QueryCodec}. */
  readonly serializable?: true | QueryCodec<T>
}

/** Options for {@link mutation}. */
export interface MutationOptions<I, T> {
  readonly run: (input: I) => Body<T>
  /** A call while one is in flight: `switch` interrupts it, `queue` waits, `parallel` (default) runs both. */
  readonly concurrency?: 'switch' | 'queue' | 'parallel'
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

type CoreQueryAtom = CoreQuery.QueryAtom<unknown, unknown>
const queryCores = new WeakMap<object, CoreQueryAtom>()
const queryKits = new WeakMap<CoreQueryAtom, CachedQuery<unknown>>()
const mutationCores = new WeakMap<object, CoreMutation.Mutation<unknown, unknown, unknown, never>>()

/** @internal The core query atom behind a kit query. */
export const coreQuery = (q: CachedQuery<unknown>): CoreQueryAtom => queryCores.get(q)!
const passthrough: QueryCodec<unknown> = { encode: (v) => v, decode: (raw) => raw }

/** The kit codec as the core Schema; a throwing `decode` raises `QueryDecodeFailed` naming the query. */
const toSchema = (codec: QueryCodec<unknown>, key: string): Schema.Schema<unknown, any, never> =>
  Schema.transformOrFail(Schema.Unknown, Schema.Unknown, {
    strict: true,
    decode: (raw) => {
      try {
        return ParseResult.succeed(codec.decode(raw))
      } catch (e) {
        throw new SleekStackError('QueryDecodeFailed', `Query ${key} could not decode its server data: ${e instanceof Error ? e.message : String(e)}`, { key }, { cause: e })
      }
    },
    encode: (value) => ParseResult.succeed(codec.encode(value)),
  })

const serializableCores = new WeakSet<CoreQueryAtom>()
/** @internal Whether a core query atom was made by a `serializable` kit family. */
export const isSerializable = (core: CoreQueryAtom): boolean => serializableCores.has(core)

/** @internal The core mutation behind a kit mutation. */
export const coreMutation = (m: Mutation<any, unknown>) => mutationCores.get(m)!

/**
 * Defines a cached query: `(args) => CachedQuery`, one entry per canonical `key(args)`. Concurrent reads of a key
 * share one fetch; `staleTime` and `gcTime` control refetching and eviction.
 *
 * @param options - `key`, `fetch` (a generator; `yield*` Tags), `staleTime`, `gcTime`, `retry`.
 * @returns The family; equal keys return the same query.
 * @throws {@link SleekStackError} with code `Unknown` (from the returned family) when `key(args)` is not serializable.
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
  const family = CoreQuery.make<Args, unknown, unknown>({
    key: options.key,
    fetch: (args) => lower(() => options.fetch(args), 'query'),
    ...(options.staleTime !== undefined && { staleTime: options.staleTime }),
    ...(options.gcTime !== undefined && { gcTime: options.gcTime }),
    ...(options.retry && { retry: Schedule.recurs(options.retry) }),
  })
  return (args) => {
    let core: CoreQueryAtom
    try {
      core = family(args)
    } catch (e) {
      throw normalize(e)
    }
    let q = queryKits.get(core)
    if (!q) {
      q = {} as CachedQuery<unknown>
      queryKits.set(core, q)
      queryCores.set(q, core)
      const codec = options.serializable === true ? passthrough : options.serializable
      if (codec) serializableCores.add(core)
      if (codec) Hydrate.hydratable(() => core, { value: toSchema(codec as QueryCodec<unknown>, core[CoreQuery.TypeId].key) })(undefined)
    }
    return q as CachedQuery<T>
  }
}

/**
 * Defines a mutation. Run it with `useMutation`; invalidate affected queries with `useQueryClient`.
 *
 * @param options - `run` (a generator; `yield*` Tags) and `concurrency`.
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
  const m = {} as Mutation<I, T>
  mutationCores.set(
    m,
    CoreMutation.make<I, unknown, unknown, never>({
      run: (input) => lower(() => options.run(input), 'mutation'),
      ...(options.concurrency && { concurrency: options.concurrency }),
    }) as never,
  )
  return m
}
