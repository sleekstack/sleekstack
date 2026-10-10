import { Transfer, type StateTransfer } from '@sleekstack/ui'
import { Context, Effect, Layer } from 'effect'
import { Route } from './index'

/** A route's loader: an Effect run for the matched route, its result read by the page with `useLoader`. */
export interface Loader<A, E = never, R = never> {
  readonly key: string
  readonly load: Effect.Effect<A, E, R>
}

/** Declares a loader. `key` names it in the transfer payload; its result must be JSON-serializable (R12). */
export const loader = <A, E = never, R = never>(key: string, load: Effect.Effect<A, E, R>): Loader<A, E, R> => ({
  key,
  load,
})

/** Loader results of one render (server) or app (client), keyed by loader key and pathname. */
export class Loaders extends Context.Tag('@sleekstack/router/Loaders')<Loaders, Map<string, unknown>>() {}

/**
 * The loader's result for the matched route: a held result (sent by the server, or loaded earlier) returns at once,
 * else the loader runs and its result is held. Put the page under `Pending` to show a fallback meanwhile; a failure is
 * the loader's typed error, for the nearest `Boundary`; interrupting the read interrupts the loader.
 */
export const useLoader = <A, E, R>(l: Loader<A, E, R>): Effect.Effect<A, E, R | Route | Loaders> =>
  Effect.gen(function* () {
    const { pathname } = yield* Route
    const held = yield* Loaders
    const key = `${l.key} ${pathname}`
    if (held.has(key)) return held.get(key) as A
    const data = yield* l.load
    held.set(key, data)
    return data
  })

// Sends held results; a stream asks once per flush and gets only those not sent yet.
const transfer = (held: Map<string, unknown>): StateTransfer => {
  const sent = new Set<string>()
  return {
    dehydrate: () => {
      const fresh = [...held].filter(([k]) => !sent.has(k) && (sent.add(k), true))
      return fresh.length > 0 ? Object.fromEntries(fresh) : undefined
    },
    hydrate: (state) => {
      if (typeof state !== 'object' || state === null || Array.isArray(state))
        throw new Error('loader state is not an object')
      for (const [k, v] of Object.entries(state)) held.set(k, v)
    },
  }
}

/**
 * `Loaders` plus the `Transfer` that carries them: `renderToString` / `renderToStream` send loader results and
 * `hydrateMount` seeds them, so the client reads them without running the loader again. One per render or app.
 */
export const LoaderTransferLive: Layer.Layer<Loaders | Transfer> = Layer.effect(
  Transfer,
  Effect.map(Loaders, transfer),
).pipe(Layer.provideMerge(Layer.sync(Loaders, () => new Map<string, unknown>())))
