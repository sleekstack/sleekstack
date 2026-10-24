# @sleekstack/start

The server entry for a `@sleekstack/ui` app: `start({ router, layer, middleware, handlers, controllers, functions, services, origins, bodyLimit, onError })` returns `{ fetch }`, which answers each request through middleware, then server functions and Server Service methods (`POST /_sleek/fn/<id>`), then route handlers, then Controllers, then the router's page. `start()` with no options serves the app that `serverServices()` of `@sleekstack/ui-vite` discovers (Controllers, the file router, the Layer Files composed by requirement, the generated Server Services of RPC Files and the RPC Manifest, and the Server Root's `onError`), and given options merge with it; `router` is optional. `start({ layer })` and `start({ onError })` win over the discovered ones (ADR 0054). An app with no Tag left to provide omits `layer`: the option does not accept `Layer.empty`. Browser code calls server functions through `@sleekstack/start/client`.

## Exports

| Entry                      | Export                                                                                                     | What                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `@sleekstack/start`        | `start`, `Start`, `StartOptions`                                                                           | the server entry and its options                                                            |
|                            | `serverFn`, `ServerFn`                                                                                     | declares a server function                                                                  |
|                            | `ServerService`, `ServerServiceEntry`, `ServerServiceShape`, `ServerServiceMethodSchemas`                  | declares a Server Service; `services` takes its entries                                     |
|                            | `implement`                                                                                                | a Server Service implementation Layer; its methods may use the request services             |
|                            | `taggedError`                                                                                              | a Schema for a `Data.TaggedError` class                                                     |
|                            | `Handler`, `Method`                                                                                        | a route handler: one Effect per HTTP method                                                 |
|                            | `Wrap`, `RpcWrap`                                                                                          | the type of a Controller's or `_defaults.ts` `wrap` export, and of an RPC File's (ADR 0054) |
|                            | `DiscoveredApp`, `ControllerEntry`, `ControllerMethodEntry`, `ControllerOptions`                           | the discovered app (`virtual:sleek/server-app`) and its Controller entries                  |
|                            | `Middleware`                                                                                               | runs before every other stage; a `Response` short-circuits                                  |
|                            | `Request`, `Cookies`, `ResponseHeaders`, `ResponseStatus`, `CookieJar`, `CookieOptions`, `RequestServices` | the request services (Tags)                                                                 |
|                            | `InvalidCookie`, `InvalidStatus`, `DuplicateServerFn`, `InvalidServerFnId`, `InvalidOrigin`, `DecodeError` | errors                                                                                      |
|                            | `InvalidPathEncoding`, `MethodNotAllowed`, `BodyTooLarge`, `UnsupportedMediaType`                          | a Controller's routing failures, which reach its `wrap`                                     |
| `@sleekstack/start/client` | `client`, `Contract`, `Stub`                                                                               | the browser stub, typed from a client-safe contract                                         |
|                            | `serverClient`, `serverClients`                                                                            | Server Service Tags as browser Layers over the wire                                         |
|                            | `ServerService`, `taggedError`, `ServerServiceEntry`                                                       | the contract side, also exported here                                                       |
|                            | `NetworkError`, `DecodeError`                                                                              | the stub's own failures                                                                     |

Decisions: ADR 0039, ADR 0051 (Server Services), ADR 0052 (request services in an implementation), ADR 0053 (Controllers). The registry for `services`, the browser Layer and the discovered app are generated by `serverServices()` in `@sleekstack/ui-vite` (`virtual:sleek/server-registry`, `virtual:sleek/server`, `virtual:sleek/server-app`). Tests call a server function, a Server Service method, a handler or a Controller without HTTP through `callServerFn`, `callService`, `callHandler` and `callController` from `@sleekstack/testing`.

## Controllers

A Controller is a `*.controller.ts` file under `server/routes`: its path sets its URL, and its exported `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE` and `OPTIONS` methods take `{ params?, query?, body? }`, decoded from the Schemas the Vite plugin reads from their written-out signatures. A method shapes its answer through the request services; `yield* ResponseStatus.set(201)` sets the status (default 200, or 204 for `void`), and a status that is not an integer from 200 to 599 dies with `InvalidStatus`. `ResponseStatus` has no effect anywhere else: a Server Service implementation may require it, and the server-function wire ignores it.

A Controller or a `_defaults.ts` file (Directory Defaults, for every Controller below it) may export:

- `wrap(next, request)`: runs around decode, method and encode, outer first; it provides services and maps failures to answers.
- `bodyLimit`: the largest body of a method that declares `body`. The Controller's own export wins, then the nearest `_defaults.ts`, then `start({ bodyLimit })`, then 1 MiB.
- `origins`: added to the server-function allow-list below; no file can remove an origin.

`start({ controllers })` adds entries, matched after the discovered ones, and a `services` entry whose Tag is already listed registers nothing. The files are read on the first request, so a `bodyLimit` export that is not a positive integer, or an `origins` export with an invalid entry, fails that request's app load naming the file, not the `start` call. Unhandled by `wrap`, a decode failure answers 400 with the `DecodeError` JSON (malformed JSON is `is not valid JSON`), `InvalidPathEncoding` 404 with no body, `MethodNotAllowed` 405 with `Allow`, `BodyTooLarge` 413, `UnsupportedMediaType` 415 (a method that declares `body` needs `Content-Type: application/json`), and any other failure an empty 500. Guide: `apps/docs/content/docs/controllers.mdx`.

## Origins and CORS

Every server-function call passes a same-origin check: the request's own origin passes, and so does each entry in `origins` and in every `origins` export of a Controller, an RPC File, the RPC Manifest or a `_defaults.ts`; an export only adds origins. An entry is a bare origin such as `https://app.example` or `http://localhost:3000`. Case, a trailing slash and a default port are normalized; anything else (a path, a query, credentials, a bare host, `*`) fails `start` with `InvalidOrigin`. A Controller has no origin check: its `application/json` rule for bodies stops cross-site form posts.

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
