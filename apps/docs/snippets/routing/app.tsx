/** @jsxImportSource @sleekstack/ui */
import { Effect, Schema } from 'effect'
import { el } from '@sleekstack/ui'
import { handle, loader, notFound, params, router, routes, startRouter, useLoader } from '@sleekstack/router'

const table = routes({ home: '/', user: '/users/:id' })

const user = loader(
  'user',
  Schema.Struct({ name: Schema.String }),
  Effect.flatMap(params(table, 'user'), ({ id }) => (id === '0' ? notFound() : Effect.succeed({ name: `User ${id}` }))),
)

const UserPage = () => Effect.map(useLoader(user), (u) => el('h1', {}, u.name))

const app = router({
  table,
  pages: {
    home: { render: () => <a href="/users/7">Ada</a> },
    user: { render: UserPage, loaders: [user], fallback: 'Loading' },
  },
  notFound: () => <h1>Not found</h1>,
})

// Server: 200 with the page, 302 for a redirect, 404 for not-found.
export const fetch = (request: Request) =>
  handle(app, request, { document: { before: '<!doctype html><body><div id="app">', after: '</div></body>' } })

// Browser: hydrates, then handles link clicks, back / forward and scroll.
export const start = () => startRouter(app, { container: document.getElementById('app')! })
