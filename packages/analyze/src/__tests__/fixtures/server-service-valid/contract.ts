import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'

export type Profile = { readonly name: string }
export interface Ids { readonly id: number }
export class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string }> {}
export class Profiles extends ServerService('Profiles')<
  Profiles,
  {
    readonly rename: (input: { readonly name: string }) => Effect.Effect<{ readonly name: string }, NameTaken>
    readonly list: () => Effect.Effect<readonly Profile[]>
    get(input: Ids): Effect.Effect<Profile, NameTaken, never>
  }
>() {}
