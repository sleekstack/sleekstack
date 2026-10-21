import { ServerService } from '@sleekstack/start/client'
import type { Effect } from 'effect'

export class Profiles extends ServerService('Profiles')<Profiles, { readonly count: () => Effect.Effect<number> }>() {}
export class Accounts extends ServerService('Accounts')<Accounts, { readonly count: () => Effect.Effect<number> }>() {}
