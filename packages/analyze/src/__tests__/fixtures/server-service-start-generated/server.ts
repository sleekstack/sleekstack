import { router, routes } from '@sleekstack/router'
import { start, type ServerServiceEntryOf } from '@sleekstack/start'
import { Effect, Layer } from 'effect'
import { Notes } from 'virtual:sleek/rpc'
import { Accounts, Profiles } from './contract'

declare const services: ReadonlyArray<ServerServiceEntryOf<typeof Notes | typeof Profiles | typeof Accounts>>
const app = router({ table: routes({}), pages: {}, notFound: () => Effect.dieMessage('none') })
const ProfilesLive = Layer.succeed(Profiles, { count: () => Effect.succeed(1) })

// `Notes` is generated from an RPC File, so the discovered app provides it; `Accounts` has no implementation.
export const server = start({ router: app, layer: ProfilesLive, services }) // @error MissingDependency
