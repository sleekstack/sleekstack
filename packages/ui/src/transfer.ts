import { Context } from 'effect'

/**
 * State outside the atom store that a server render hands to the client (a query cache, say). A layer provides it;
 * `renderToString` / `renderToStream` write what `dehydrate` returns into the hydration payload, and `hydrateMount`
 * calls `hydrate` with each sent state before the app's first run.
 */
export interface StateTransfer {
  /** The state to send now, or `undefined` for none. A stream calls it once per flush: return only what changed since the last call. */
  dehydrate(): unknown
  /** Seeds the client from one state `dehydrate` returned. Throws when the state is malformed (reported as `HydratePayloadInvalid`). */
  hydrate(state: unknown): void
}
export class Transfer extends Context.Tag('@sleekstack/ui/Transfer')<Transfer, StateTransfer>() {}
