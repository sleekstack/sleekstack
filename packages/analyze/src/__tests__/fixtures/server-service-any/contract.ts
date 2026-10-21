import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'

export class Profiles extends ServerService('Profiles')<Profiles, {
  readonly rename: (input: { readonly name: any }) => Effect.Effect<void> // @error ServerServiceMethodShape
}>() {}
