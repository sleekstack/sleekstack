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
| `loader(key, effect)` | Declares a route loader; its result must be JSON-serializable. |
| `useLoader(loader)` | The loader's result for the matched route: held data returns at once, else the loader runs (put the page under `Pending`). Its typed error reaches the nearest `Boundary`. |
| `LoaderTransferLive` | Holds loader results per render or app and sends them through the ui `Transfer`, so a hydrating client reads them without reloading. |

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
const user = loader('user', Effect.map(params(table, 'user'), ({ id }) => ({ id })))
const UserPage = () => Effect.map(useLoader(user), (u) => el('h1', {}, u.id))

const layer = Layer.merge(LoaderTransferLive, routeLayer(m))
const app = <Pending fallback="Loading"><UserPage /></Pending>
await renderToStream(app, { layer }) // shell with the fallback first, then the page
```

`LoaderTransferLive` is the scope's one `Transfer`, so it cannot yet sit beside `QueryTransferLive` in the same layer.
