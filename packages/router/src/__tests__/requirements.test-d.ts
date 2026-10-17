import { el } from '@sleekstack/ui'
import { Context, Effect, Layer, Schema } from 'effect'
import { handle, loader, params, router, routes, startRouter, useLoader, type Router } from '../index'

class Db extends Context.Tag('Db')<Db, { readonly name: string }>() {}
class Clock extends Context.Tag('Clock')<Clock, { readonly now: number }>() {}

declare const container: Element
declare const request: Request
const dbLayer = Layer.succeed(Db, { name: 'db' })
const clockLayer = Layer.succeed(Clock, { now: 0 })

const table = routes({ home: '/', user: '/users/:id' })
const shell = () => Effect.succeed(el('p', {}, 'shell'))

// Pages here render plain Effects. A JSX render (`() => <NeedsDb />`) is out of scope: ui types every JSX
// expression as requirement-free, so its services are checked by `sleekstack check` (R12), not by `R`.

// A page whose render reads a server-only service.
const dbPage = router({
  table,
  pages: { home: { render: () => Effect.as(Db, el('h1', {}, 'db')) }, user: { render: shell } },
  notFound: shell,
})

// A page whose loader reads a server-only service; `params` and `useLoader` add only router-provided services.
const user = loader(
  'user',
  Schema.Struct({ name: Schema.String }),
  Effect.flatMap(params(table, 'user'), ({ id }) => Effect.map(Db, (db) => ({ name: `${db.name} ${id}` }))),
)
const dbLoader = router({
  table,
  pages: {
    home: { render: () => Effect.as(Clock, el('h1', {}, 'home')) },
    user: { render: () => Effect.map(useLoader(user), (u) => el('h1', {}, u.name)), loaders: [user] },
  },
  notFound: shell,
})

// Pages that need nothing beyond what the router provides.
const free = router({
  table,
  pages: { home: { render: shell }, user: { render: () => Effect.as(params(table, 'user'), el('p', {}, 'user')) } },
  notFound: shell,
})

export const checks = () => [
  // @ts-expect-error the client layer lacks `Db`, which the page reads
  startRouter(dbPage, { container, layer: Layer.empty }),
  // @ts-expect-error the page needs `Db`, so a layer is required
  startRouter(dbPage, { container }),
  startRouter(dbPage, { container, layer: dbLayer }),
  // @ts-expect-error the server layer lacks `Db`
  handle(dbPage, request, { layer: clockLayer }),
  // @ts-expect-error the page needs `Db`, so options with a layer are required
  handle(dbPage, request),
  handle(dbPage, request, { layer: dbLayer }),

  // @ts-expect-error a loader re-runs in the browser on navigation: a client layer without `Db` is rejected
  startRouter(dbLoader, { container, layer: clockLayer }),
  startRouter(dbLoader, { container, layer: Layer.merge(dbLayer, clockLayer) }),

  startRouter(free, { container }),
  handle(free, request),
  handle(free, request, { stream: true }),
]

// A router annotated without its requirements keeps today's unchecked layer.
declare const untracked: Router<typeof table>
export const legacy = () => [startRouter(untracked, { container }), handle(untracked, request)]
