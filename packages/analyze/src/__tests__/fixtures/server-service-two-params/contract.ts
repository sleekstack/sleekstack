import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'

export class Profiles extends ServerService('Profiles')<Profiles, {
  readonly rename: (id: number, name: string) => Effect.Effect<void> // @error ServerServiceMethodShape
}>() {}
