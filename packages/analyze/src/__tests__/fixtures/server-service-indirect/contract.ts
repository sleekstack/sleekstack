import { ServerService } from '@sleekstack/start/client'
import type { Effect } from 'effect'

const base = ServerService('Profiles')<Profiles, { readonly count: () => Effect.Effect<number> }>() // @error Unresolvable
export class Profiles extends base {}
