import { ServerService } from '@sleekstack/start/client'
import { Data, type Effect } from 'effect'

export class Db extends Data.TaggedError('Db')<{}> {}
export class Profiles extends ServerService('Profiles')<Profiles, {
  readonly rename: (name: string) => Effect.Effect<void, never, Db> // @error ServerServiceMethodShape
}>() {}
