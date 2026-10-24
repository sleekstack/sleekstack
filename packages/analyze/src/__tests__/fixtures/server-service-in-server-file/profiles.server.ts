import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'

export class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string }> {}
export class Profiles extends ServerService('Profiles')<Profiles, { // @error ServerServiceFileShape
  readonly rename: (input: { readonly name: string }) => Effect.Effect<{ readonly name: string }, NameTaken> // @error ServerServiceMethodShape
}>() {}
