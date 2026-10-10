# @sleekstack/router

Typed routes for apps on the `@sleekstack/ui` host (ADR 0036). A route table is a `const` object of path strings; params are inferred from the path string, with no code generation. `@sleekstack/ui` does not depend on this package.

| Export | What it does |
| --- | --- |
| `routes(table)` | Declares a route table, keeping its path strings literal. |
| `Params<P>` | The params of a path string: `Params<'/users/:id'>` is `{ readonly id: string }`. |
| `match(table, pathname)` | The first route in table order matching the percent-decoded `pathname` (`:name` matches one whole non-empty segment), as an `Option<Match>`; a malformed escape matches nothing. |
| `Route` | The matched route as a service: `name`, `path`, `params`, `pathname`. |
| `routeLayer(match)` | Provides `Route` around the page. |
| `params(table, name)` | The matched route's params typed from `table[name]`; dies if the page runs under another route. |
| `loader(key, schema, effect)` | Declares a route loader; `schema` encodes its result for the client. |
| `useLoader(loader)` | The loader's result for the matched route: held data returns at once, a load in flight is shared, else the loader runs (put the page under `Pending`). Its typed error reaches the nearest `Boundary`. |
| `LoaderTransferLive` | Holds loader results per render or app and sends them through the ui `Transfer`, so a hydrating client reads them without reloading. |
| `prefetchLoader(loader, match)` | Starts a loader for a route ahead of the page; its result is held 30 seconds unread, and a failure is silent. |
| `Link` | An `<a href>` that prefetches its route's `code` (the `lazy` import) and `loaders` on hover or focus; `prefetch={false}` opts out. |
| `redirect(to)` / `notFound()` | Raised by a loader or action: control flow, not a failure. The server answers 302 / 404; the browser navigates or shows the not-found page. |
| `router({ table, pages, notFound })` | A page per route (`render`, `loaders`) plus the not-found page. |
| `handle(router, request, opts)` | Server entry: answers with the rendered page, a 302, a 404, or the loader error's `status` (else 500); `stream: true` sends the shell first. More than `MAX_REDIRECTS` (10) redirects is a 500 with `RedirectLoop`. |
| `startRouter(router, { container })` | Browser entry: hydrates or mounts, handles same-origin link clicks, back / forward and scroll restoration. A newer navigation interrupts the pending one and stops its loads. |
| `action(run)` | Declares a route action in any form a form `action` takes: function, generator, Effect or `defineHandler` value. |

```tsx
import { Effect, Option } from 'effect'
import { el, Provider } from '@sleekstack/ui'
import { match, params, routeLayer, routes } from '@sleekstack/router'

const table = routes({ home: '/', user: '/users/:id' })

const UserPage = () => Effect.map(params(table, 'user'), ({ id }) => el('h1', {}, id))

const m = Option.getOrThrow(match(table, location.pathname))
const app = <Provider layer={routeLayer(m)}><UserPage /></Provider>
```

A page reading a loader, rendered on the server and hydrated with the same data:

```tsx
const user = loader('user', Schema.Struct({ id: Schema.String }), Effect.map(params(table, 'user'), ({ id }) => ({ id })))
const UserPage = () => Effect.map(useLoader(user), (u) => el('h1', {}, u.id))

const layer = Layer.merge(LoaderTransferLive, routeLayer(m))
const app = <Pending fallback="Loading"><UserPage /></Pending>
await renderToStream(app, { layer }) // shell with the fallback first, then the page
```

`LoaderTransferLive` carries another `Transfer` it is given: `LoaderTransferLive.pipe(Layer.provideMerge(UiQueryClientLive()))` sends both loader and query state.

A link that warms the next page, and the page's form action:

```tsx
<Link href="/users/7" table={table} code={() => import('./UserPage')} loaders={[user]}>Ada</Link>

const save = action(function* (e: ActionEvent) { yield* saveUser(e.formData) })
const EditPage = () => <form action={save}>...</form>
```

Serving and running the app:

```tsx
const app = router({ table, pages: { home: { render: Home }, user: { render: UserPage, loaders: [user] } }, notFound: NotFoundPage })

export default { fetch: (request: Request) => handle(app, request, { document: { before: '<!doctype html><body><div id="app">', after: '</div></body>' } }) }

await startRouter(app, { container: document.getElementById('app')! })
```

A string response runs the page's declared `loaders` first, so it knows its status (a redirect or not-found from an undeclared loader is answered too). With `stream: true` the shell goes first with status 200; a later redirect is sent as a `location.replace` script and a later not-found as the not-found page replacing the body. Each browser navigation loads again; a failed loader runs once and its `Boundary` gets that failure.
