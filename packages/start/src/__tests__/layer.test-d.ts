import { params, router, routes, type Router } from '@sleekstack/router'
import { el } from '@sleekstack/ui'
import { Context, Effect, Layer } from 'effect'
import { Cookies, Request, ResponseHeaders, start } from '../index'

class Db extends Context.Tag('Db')<Db, { readonly name: string }>() {}
class Clock extends Context.Tag('Clock')<Clock, { readonly now: number }>() {}

const dbLayer = Layer.succeed(Db, { name: 'db' })
const clockLayer = Layer.succeed(Clock, { now: 0 })
const table = routes({ home: '/', user: '/users/:id' })
const shell = () => Effect.succeed(el('p', {}, 'shell'))

// The router's own services and the request services never come from the app layer.
const plain = router({
  table,
  pages: {
    home: { render: () => Effect.as(Effect.all([Cookies, Request, ResponseHeaders]), el('p', {}, 'home')) },
    user: { render: () => Effect.as(params(table, 'user'), el('p', {}, 'user')) },
  },
  notFound: shell,
})
start({ router: plain })

const dbPage = router({
  table,
  pages: { home: { render: () => Effect.as(Db, el('p', {}, 'db')) }, user: { render: shell } },
  notFound: shell,
})
start({ router: dbPage, layer: dbLayer })
// @ts-expect-error a page needs Db and the layer is missing
start({ router: dbPage })
// @ts-expect-error a page needs Db and the layer provides only Clock
start({ router: dbPage, layer: clockLayer })

const needsDb = () => Effect.as(Db, new Response())
start({ router: plain, layer: dbLayer, handlers: { '/api': { GET: needsDb } } })
start({ router: plain, layer: dbLayer, middleware: [() => Effect.as(Db, undefined)] })
// @ts-expect-error a handler needs Db
start({ router: plain, handlers: { '/api': { GET: needsDb } } })
// @ts-expect-error a middleware needs Db
start({ router: plain, layer: clockLayer, middleware: [() => Effect.as(Db, undefined)] })

// A router annotated without R is not tracked, so the layer is optional.
declare const untyped: Router
start({ router: untyped })
