import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'

/** The tally is at its limit: the declared error, so it crosses the wire as this class. */
export class TallyLimit extends Data.TaggedError('TallyLimit')<{ readonly limit: number }> {}

/**
 * A Server Service: the contract only. `server/tally.server.ts` implements it; the build generates the browser client
 * (`virtual:sleek/server`) and the server registry from these types, with no Schema, id or stub written here.
 */
export class Tally extends ServerService('Tally')<
  Tally,
  {
    readonly add: (input: { readonly by: number }) => Effect.Effect<number, TallyLimit>
    readonly read: () => Effect.Effect<number>
  }
>() {}
