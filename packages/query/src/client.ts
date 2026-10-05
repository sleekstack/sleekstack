/**
 * packages/query/src/client.ts
 *
 * The SleekStack bridge over `@tanstack/query-core`: a scoped `QueryClient` and `effectFn`.
 */
import { QueryClient, type QueryClientConfig } from '@tanstack/query-core'
import { Cause, Context, Effect, Exit, FiberId, Layer, Option } from 'effect'

/** The part of TanStack's query / mutation function context `effectFn` reads. */
type FnContext = { signal?: AbortSignal; client?: QueryClient }

/** The scope's TanStack `QueryClient`. */
export class QueryClientTag extends Effect.Tag('QueryClientTag')<QueryClientTag, QueryClient>() {}

/** The `Context` each client's layer was built in, read by `effectFn`. */
const contexts = new WeakMap<QueryClient, Context.Context<never>>()

/**
 * A scoped layer providing a mounted `QueryClient`; on scope close it is unmounted and cleared.
 * A throwing config function fails the layer with the original error.
 */
export const QueryClientLive = (
  config?: QueryClientConfig | (() => QueryClientConfig),
): Layer.Layer<QueryClientTag, unknown> =>
  Layer.scoped(
    QueryClientTag,
    Effect.gen(function* () {
      const resolved = typeof config === 'function' ? yield* Effect.try({ try: config, catch: (e) => e }) : config
      const client = new QueryClient(resolved)
      const ctx = yield* Effect.context<never>()
      contexts.set(client, Context.add(ctx, QueryClientTag, client) as Context.Context<never>)
      client.mount()
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          client.unmount()
          client.clear()
          contexts.delete(client)
        }),
      )
      return client
    }),
  )

/**
 * Lowers `effect` to a TanStack `queryFn` / `mutationFn` run with the services of the calling
 * client's layer. Rejects with the original failure or the defect, never a `FiberFailure`;
 * `signal` abort interrupts the fiber. `R` is not checked against the layer: a missing Tag rejects.
 */
export const effectFn =
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  async (...args: [ctx?: FnContext] | [variables: unknown, ctx: FnContext]): Promise<A> => {
    // queryFn is called as (ctx), mutationFn as (variables, ctx).
    const ctx = (args.length > 1 ? args[1] : args[0]) as FnContext | undefined
    const services = (ctx?.client && contexts.get(ctx.client)) ?? Context.empty()
    const signal = ctx?.signal
    const exit = signal?.aborted
      ? Exit.interrupt(FiberId.none)
      : await Effect.runPromiseExit(Effect.provide(effect, services) as Effect.Effect<A, E>, { signal })
    if (Exit.isSuccess(exit)) return exit.value
    const failure = Cause.failureOption(exit.cause)
    if (Option.isSome(failure)) throw failure.value
    const defect = Cause.dieOption(exit.cause)
    if (Option.isSome(defect)) throw defect.value
    throw Cause.squash(exit.cause)
  }
