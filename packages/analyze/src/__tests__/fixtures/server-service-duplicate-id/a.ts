import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'

export class A extends ServerService('Profiles')<A, {
  readonly count: () => Effect.Effect<number>
}>() {}
