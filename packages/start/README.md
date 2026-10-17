# @sleekstack/start

The server entry for a `@sleekstack/ui` app: `start({ router, layer, middleware, handlers, functions, origins, bodyLimit, onError })` returns `{ fetch }`, which answers each request through middleware, then server functions (`POST /_sleek/fn/<id>`), then route handlers, then the router's page. Browser code calls server functions through `@sleekstack/start/client`.

## Origins and CORS

Every server-function call passes a same-origin check: the request's own origin passes, and so does each entry in `origins`. An entry is a bare origin such as `https://app.example` or `http://localhost:3000`. Case, a trailing slash and a default port are normalized; anything else (a path, a query, credentials, a bare host, `*`) fails `start` with `InvalidOrigin`.

`origins` only lets a listed origin's call run. The framework sends no CORS headers, so the app owns them in middleware: answer the preflight and set the allow headers through `ResponseHeaders`, which reach the server function's response.

```ts
import { type Middleware, ResponseHeaders, start } from '@sleekstack/start'
import { Effect } from 'effect'

const allowed = 'https://app.example'

const cors: Middleware = (request) =>
  Effect.gen(function* () {
    if (request.headers.get('origin') !== allowed) return
    const headers = yield* ResponseHeaders
    headers.set('access-control-allow-origin', allowed)
    headers.set('vary', 'Origin')
    if (request.method === 'OPTIONS') {
      headers.set('access-control-allow-methods', 'POST')
      headers.set('access-control-allow-headers', 'content-type')
      return new Response(null, { status: 204 })
    }
  })

export default start({ router, functions, origins: [allowed], middleware: [cors] })
```
