import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'

export class B extends ServerService('Profiles')<B, { // @error ServerServiceFileShape
  readonly count: () => Effect.Effect<number>
}>() {}
