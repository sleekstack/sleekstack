import { Context, Effect } from 'effect'
import { type GeneratedServiceShape, rpc, serviceLayer } from '../index'

// What the generated declaration writes: each Controller's module by its route name.
declare module 'virtual:sleek/server-app' {
  interface ControllerModules {
    readonly 'api/tally': { readonly GET: unknown; readonly POST: unknown; readonly helper: unknown }
    readonly 'api/index': { readonly GET: unknown }
  }
}

rpc({ Tally: { read: 'GET api/tally', add: 'POST api/tally' }, Home: { index: 'GET api/index' } })
rpc({ Tally: { add: 'POST api/tally' } }, { bodyLimit: 1024, origins: ['https://app.test'] })
// @ts-expect-error the Controller does not export DELETE
rpc({ Tally: { remove: 'DELETE api/tally' } })
// @ts-expect-error a non-verb export is not a Controller Method
rpc({ Tally: { helper: 'helper api/tally' } })
// @ts-expect-error a renamed or removed Controller is an unknown route
rpc({ Tally: { add: 'POST api/counter' } })

const methods = { ping: (): Effect.Effect<string> => Effect.succeed('pong') }
class Pinger extends Context.Tag('Pinger')<Pinger, GeneratedServiceShape<typeof methods>>() {}
serviceLayer(Pinger, methods)
// @ts-expect-error the methods do not match the Tag's
serviceLayer(Pinger, { ping: (): Effect.Effect<number> => Effect.succeed(1) })
