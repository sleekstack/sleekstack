import { ServerService } from '@sleekstack/start/client'
import type { Effect } from 'effect'
import { db } from './db.server' // @error ServerServiceFileShape

export type Db = typeof db
export class Profiles extends ServerService('Profiles')<Profiles, {
  readonly count: () => Effect.Effect<number>
}>() {}
