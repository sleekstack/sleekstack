# @sleekstack/start

The server entry for a `@sleekstack/ui` app: `start({ router, layer, middleware, handlers, functions, origins, bodyLimit, onError })` returns `{ fetch }`, which answers each request through middleware, then server functions (`POST /_sleek/fn/<id>`), then route handlers, then the router's page. Browser code calls server functions through `@sleekstack/start/client`.

## Exports

| Entry                      | Export                                                                                    | What                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `@sleekstack/start`        | `start`, `Start`, `StartOptions`                                                          | the server entry and its options                           |
|                            | `serverFn`, `ServerFn`                                                                    | declares a server function                                 |
|                            | `Handler`, `Method`                                                                       | a route handler: one Effect per HTTP method                |
|                            | `Middleware`                                                                              | runs before every other stage; a `Response` short-circuits |
|                            | `Request`, `Cookies`, `ResponseHeaders`, `CookieJar`, `CookieOptions`, `RequestServices`  | the request services (Tags)                                |
|                            | `InvalidCookie`, `DuplicateServerFn`, `InvalidServerFnId`, `InvalidOrigin`, `DecodeError` | errors                                                     |
| `@sleekstack/start/client` | `client`, `Contract`, `Stub`                                                              | the browser stub, typed from a client-safe contract        |
|                            | `NetworkError`, `DecodeError`                                                             | the stub's own failures                                    |

Decisions: ADR 0039. Tests call a server function or a handler without HTTP through `callServerFn` and `callHandler` from `@sleekstack/testing`.

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
