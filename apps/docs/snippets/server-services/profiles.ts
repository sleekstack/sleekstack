import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'

export class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string }> {}

export interface Profile {
  readonly name: string
}

/** The contract: types, tagged errors and ServerService classes only, so the browser may import this file. */
export class Profiles extends ServerService('Profiles')<
  Profiles,
  {
    readonly rename: (input: { readonly name: string }) => Effect.Effect<Profile, NameTaken>
    readonly count: () => Effect.Effect<number>
  }
>() {}
