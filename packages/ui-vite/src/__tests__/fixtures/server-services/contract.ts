import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'
import { Missing } from './errors'

export class NameTaken extends Data.TaggedError('NameTaken')<{ readonly name: string }> {}

export interface Profile {
  readonly name: string
  readonly tags: readonly string[]
}

export class Profiles extends ServerService('Profiles')<
  Profiles,
  {
    readonly rename: (input: { readonly name: string }) => Effect.Effect<Profile, NameTaken | Missing>
    readonly count: () => Effect.Effect<number>
  }
>() {}
