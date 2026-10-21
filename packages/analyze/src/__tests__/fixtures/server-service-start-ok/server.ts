import { router, routes } from '@sleekstack/router'
import { start, type ServerServiceEntryOf } from '@sleekstack/start'
import { Effect, Layer } from 'effect'
import { Accounts, Profiles } from './contract'

declare const services: ReadonlyArray<ServerServiceEntryOf<typeof Profiles | typeof Accounts>>
const app = router({ table: routes({}), pages: {}, notFound: () => Effect.dieMessage('none') })
const ProfilesLive = Layer.succeed(Profiles, { count: () => Effect.succeed(1) })
const AccountsLive = Layer.succeed(Accounts, { count: () => Effect.succeed(2) })

export const server = start({ router: app, layer: Layer.mergeAll(ProfilesLive, AccountsLive), services })
