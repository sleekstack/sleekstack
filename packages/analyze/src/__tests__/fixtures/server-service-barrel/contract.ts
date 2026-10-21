import type { Effect } from 'effect'
import { ServerService } from './start'

export class Accounts extends ServerService('Accounts')<Accounts, { readonly count: () => Effect.Effect<number> }>() {}
