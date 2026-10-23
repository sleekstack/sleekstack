import { ServerService } from '@sleekstack/start'
import type { Effect } from 'effect'

export class Diary extends ServerService('Journal')<Diary, { readonly read: () => Effect.Effect<string> }>() {}
