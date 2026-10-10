import { Transfer, type StateTransfer } from '@sleekstack/ui'
import { Context, Effect, Exit, Fiber, Layer, Option, Schema } from 'effect'
import { Route, routeLayer, type Match } from './index'

/** A route's loader: an Effect run for the matched route, its result read by the page with `useLoader`. */
export interface Loader<A, I, E = never, R = never> {
  readonly key: string
  readonly schema: Schema.Schema<A, I>
  readonly load: Effect.Effect<A, E, R>
}

/** Declares a loader. `key` names it in the transfer payload; `schema` encodes its result for the client (R12). */
export const loader = <A, I, E = never, R = never>(
  key: string,
  schema: Schema.Schema<A, I>,
  load: Effect.Effect<A, E, R>,
): Loader<A, I, E, R> => ({ key, schema, load })

// A held result: `value` once decoded or loaded, `encoded` once encoded or sent by the server; `load` while loading,
// shared by `readers` reads.
export interface Held {
  value?: unknown
  encoded?: unknown
  load?: Fiber.RuntimeFiber<unknown, unknown>
  readers: number
  // Set while a prefetch is unread: past it the load is stopped and the result dropped. A page read keeps it for good.
  expires?: number
}

/** How long a prefetched loader result waits for a page to read it (R13). */
const PREFETCH_TTL = 30_000

// Drops an expired prefetch, stopping its load if it is still running.
const evict = (all: Map<string, Held>, key: string, h: Held): Effect.Effect<void> => {
  all.delete(key)
  return h.load ? Effect.asVoid(Fiber.interrupt(h.load)) : Effect.void
}

// Forks `l`'s load into a new entry under `key`; a failed or interrupted load removes it.
const start = <A, I, E, R>(
  all: Map<string, Held>,
  key: string,
  load: Effect.Effect<A, E, R>,
  schema: Schema.Schema<A, I>,
  ttl?: number,
) =>
  Effect.gen(function* () {
    const e: Held = ttl === undefined ? { readers: 0 } : { readers: 0, expires: Date.now() + ttl }
    all.set(key, e)
    e.load = yield* Effect.forkDaemon(
      Effect.flatMap(load, (value) =>
        Effect.map(Effect.orDie(Schema.encode(schema)(value)), (encoded) => {
          Object.assign(e, { value, encoded, load: undefined })
          return value
        }),
      ).pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => void (Exit.isSuccess(exit) || all.get(key) !== e || all.delete(key))),
        ),
      ),
    )
    return e
  })

/** Loader results of one render (server) or app (client), keyed by loader key and pathname. */
export class Loaders extends Context.Tag('@sleekstack/router/Loaders')<Loaders, Map<string, Held>>() {}

/**
 * The loader's result for the matched route: a held result (sent by the server, or loaded earlier) returns at once,
 * a load in flight is shared, else the loader runs and its result is held. Put the page under `Pending` to show a
 * fallback meanwhile; a failure is the loader's typed error, for the nearest `Boundary`. The load is interrupted
 * when its last reader is.
 */
export const useLoader = <A, I, E, R>(l: Loader<A, I, E, R>): Effect.Effect<A, E, R | Route | Loaders> =>
  Effect.gen(function* () {
    const { pathname } = yield* Route
    const all = yield* Loaders
    const key = JSON.stringify([l.key, pathname])
    let held = all.get(key)
    if (held?.expires !== undefined) {
      if (held.expires >= Date.now()) delete held.expires
      else yield* evict(all, key, held).pipe(Effect.as((held = undefined)))
    }
    if (held && !held.load) {
      if (!('value' in held)) held.value = yield* Effect.orDie(Schema.decodeUnknown(l.schema)(held.encoded))
      return held.value as A
    }
    held ??= yield* start(all, key, l.load, l.schema)
    const e = held
    e.readers++
    return yield* (Fiber.join(e.load!) as Effect.Effect<A, E>).pipe(
      Effect.ensuring(Effect.sync(() => e.readers--)),
      Effect.onInterrupt(() => (e.readers > 0 || !e.load ? Effect.void : (all.delete(key), Fiber.interrupt(e.load)))),
    )
  })

/**
 * Starts `l` for the route `m` unless its result is held or loading, and holds the result for a page to read within
 * a bounded time. A failure is silent: the page's own read runs the loader again.
 */
export const prefetchLoader = <A, I, E, R>(
  l: Loader<A, I, E, R>,
  m: Match<any, any>,
): Effect.Effect<void, never, Exclude<R, Route> | Loaders> =>
  Effect.gen(function* () {
    const all = yield* Loaders
    const key = JSON.stringify([l.key, m.pathname])
    if (all.has(key)) return
    const e = yield* start(all, key, Effect.provide(l.load, routeLayer(m)), l.schema, PREFETCH_TTL)
    yield* Effect.forkDaemon(
      Effect.sleep(PREFETCH_TTL).pipe(
        Effect.zipRight(
          Effect.suspend(() => (all.get(key) === e && e.expires !== undefined ? evict(all, key, e) : Effect.void)),
        ),
      ),
    )
  })

// Sends held results (encoded); a stream asks once per flush and gets only those not sent yet. An outer `Transfer`
// (query's, say) keeps working: its state travels beside the loaders'.
const transfer = (all: Map<string, Held>, inner: Option.Option<StateTransfer>): StateTransfer => {
  const sent = new Set<string>()
  return {
    dehydrate: () => {
      const fresh = [...all].filter(([k, h]) => 'encoded' in h && !h.load && !sent.has(k) && (sent.add(k), true))
      const loaders = fresh.length > 0 ? Object.fromEntries(fresh.map(([k, h]) => [k, h.encoded])) : undefined
      const rest = Option.isSome(inner) ? inner.value.dehydrate() : undefined
      return loaders === undefined && rest === undefined ? undefined : { loaders, rest }
    },
    hydrate: (state) => {
      const s = state as { loaders?: unknown; rest?: unknown } | null
      if (typeof s !== 'object' || s === null) throw new Error('loader state is not an object')
      if (s.loaders !== undefined) {
        if (typeof s.loaders !== 'object' || s.loaders === null) throw new Error('loader state is not an object')
        for (const [k, encoded] of Object.entries(s.loaders)) all.set(k, { encoded, readers: 0 })
      }
      if (s.rest !== undefined && Option.isSome(inner)) inner.value.hydrate(s.rest)
    },
  }
}

/**
 * `Loaders` plus the `Transfer` that carries them: `renderToString` / `renderToStream` send loader results and
 * `hydrateMount` seeds them, so the client reads them without running the loader again. One per render or app.
 * Give it another `Transfer` to carry as well: `LoaderTransferLive.pipe(Layer.provideMerge(UiQueryClientLive()))`.
 */
export const LoaderTransferLive: Layer.Layer<Loaders | Transfer> = Layer.suspend(() => withLoaders(new Map()))

/** `Loaders` over `all` plus the `Transfer` carrying them; the router keeps one `all` across a client's navigations. */
export const withLoaders = (all: Map<string, Held>): Layer.Layer<Loaders | Transfer> =>
  Layer.effect(Transfer, Effect.zipWith(Loaders, Effect.serviceOption(Transfer), transfer)).pipe(
    Layer.provideMerge(Layer.succeed(Loaders, all)),
  )
