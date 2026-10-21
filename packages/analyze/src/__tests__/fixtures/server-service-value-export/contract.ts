import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'

export class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string }> {}
export const limit = 3 // @error ServerServiceFileShape
export class Profiles extends ServerService('Profiles')<Profiles, {
  readonly rename: (input: { readonly name: string }) => Effect.Effect<{ readonly name: string }, NameTaken>
}>() {}
