import { Transfer, type StateTransfer } from '@sleekstack/ui'
import { Context, Deferred, Effect, Exit, Layer, Option, Schema } from 'effect'
import { Route } from './index'

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

// A held result: `value` once decoded or loaded, `encoded` once encoded or sent by the server; `wait` while loading.
interface Held {
  value?: unknown
  encoded?: unknown
  wait?: Deferred.Deferred<unknown, unknown>
}

/** Loader results of one render (server) or app (client), keyed by loader key and pathname. */
export class Loaders extends Context.Tag('@sleekstack/router/Loaders')<Loaders, Map<string, Held>>() {}

/**
 * The loader's result for the matched route: a held result (sent by the server, or loaded earlier) returns at once,
 * a load in flight is awaited, else the loader runs and its result is held. Put the page under `Pending` to show a
 * fallback meanwhile; a failure is the loader's typed error, for the nearest `Boundary`; interrupting the read that
 * started the load interrupts the loader.
 */
export const useLoader = <A, I, E, R>(l: Loader<A, I, E, R>): Effect.Effect<A, E, R | Route | Loaders> =>
  Effect.gen(function* () {
    const { pathname } = yield* Route
    const all = yield* Loaders
    const key = JSON.stringify([l.key, pathname])
    const held = all.get(key)
    if (held?.wait) return yield* Deferred.await(held.wait) as Effect.Effect<A, E>
    if (held && 'value' in held) return held.value as A
    if (held) return (held.value = yield* Effect.orDie(Schema.decodeUnknown(l.schema)(held.encoded)))
    const wait = yield* Deferred.make<unknown, unknown>()
    const entry: Held = { wait }
    all.set(key, entry)
    const exit = yield* Effect.exit(
      Effect.flatMap(l.load, (value) =>
        Effect.map(Effect.orDie(Schema.encode(l.schema)(value)), (encoded) => ({ value, encoded })),
      ),
    ).pipe(Effect.onInterrupt(() => (all.delete(key), Deferred.interrupt(wait))))
    yield* Deferred.done(
      wait,
      Exit.map(exit, (r) => r.value),
    )
    if (Exit.isSuccess(exit)) Object.assign(entry, exit.value, { wait: undefined })
    else all.delete(key)
    return (yield* exit).value
  })

// Sends held results (encoded); a stream asks once per flush and gets only those not sent yet. An outer `Transfer`
// (query's, say) keeps working: its state travels beside the loaders'.
const transfer = (all: Map<string, Held>, inner: Option.Option<StateTransfer>): StateTransfer => {
  const sent = new Set<string>()
  return {
    dehydrate: () => {
      const fresh = [...all].filter(([k, h]) => 'encoded' in h && !h.wait && !sent.has(k) && (sent.add(k), true))
      const loaders = fresh.length > 0 ? Object.fromEntries(fresh.map(([k, h]) => [k, h.encoded])) : undefined
      const rest = Option.isSome(inner) ? inner.value.dehydrate() : undefined
      return loaders === undefined && rest === undefined ? undefined : { loaders, rest }
    },
    hydrate: (state) => {
      const s = state as { loaders?: unknown; rest?: unknown } | null
      if (typeof s !== 'object' || s === null) throw new Error('loader state is not an object')
      if (s.loaders !== undefined) {
        if (typeof s.loaders !== 'object' || s.loaders === null) throw new Error('loader state is not an object')
        for (const [k, encoded] of Object.entries(s.loaders)) all.set(k, { encoded })
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
export const LoaderTransferLive: Layer.Layer<Loaders | Transfer> = Layer.effect(
  Transfer,
  Effect.zipWith(Loaders, Effect.serviceOption(Transfer), transfer),
).pipe(Layer.provideMerge(Layer.sync(Loaders, () => new Map<string, Held>())))
