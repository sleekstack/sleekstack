# 0039. `@sleekstack/start`: one server entry with server functions, route handlers and middleware

## Status

Accepted. Settles D1 to D4 and D6 of the Start proposal (`docs/proposals/start-framework.md`), built in spec fn-54. Supersedes nothing. Amended by ADR 0053 (file-routed Controllers answer its exact-pathname gap; `ResponseStatus` joins the request services) and ADR 0054 (server parts found by extension; `serverFn` and `functions` stay explicit).

## Context

Apps on the ui host had no server counterpart to what Next.js gives React: a component could not call the backend, there were no route handlers or middleware, and nothing wired the router, SSR and the Effect runtime into one deployable request handler. The D2 spike also found that the router erased page requirements (`Page.render` was `Effect<Node, any, any>` and the entries took `layer?: Layer<any>`), so a page needing a server-only service passed type checking under the browser entry.

## Decision

- **Package (D1).** `@sleekstack/start`, a separate package. It depends on `@sleekstack/runtime` and has `@sleekstack/router`, `@sleekstack/ui` and `effect` as peers. ui never depends on it (the ADR 0025 and 0036 boundary). `@sleekstack/kit/next` and `@sleekstack/next` are unchanged. The browser half is the `@sleekstack/start/client` subpath.
- **Entry.** `start({ router, layer, middleware, functions, handlers, origins, bodyLimit, onError })` configures the runtime over `layer` and returns `{ fetch(request): Promise<Response> }`. Each request runs in one `runEffect` Request Scope, through middleware in order (a returned `Response` skips the rest), then server functions, then the route handler for the pathname, then the router's `handle`, whose unmatched path is its not-found page with 404. A defect or an unhandled failure in any stage reaches the error sink and answers an empty 500. `layer` is required and type-checked when the stages need services beyond the router's own and the request services.
- **Request services.** `Request` (read-only), `Cookies` (`get`, `set`, `delete`; a name, value or attribute outside the cookie grammar fails with `InvalidCookie`) and `ResponseHeaders` are Tags provided per call, so a test replaces them with a layer. `Set-Cookie` lines are keyed by name, path and domain and are kept on a 500.
- **Server/client boundary (D2).** No `'use client'` / `'use server'` directives. A server-only service is absent from the browser's layer, and the boundary is checked in two places:
  - Types, for loaders and plain-Effect pages. `Router<T, R>` and `Page<R>` track what the pages, loaders and not-found page need, and `startRouter` / `handle` require a layer providing `R` minus the router's own services. A loader re-runs in the browser on navigation (ADR 0036), so it cannot read a server-only service directly; server-only work behind a loader is a server function.
  - `sleekstack check`, for JSX pages. ui types JSX as requirement-free, so the compiler sees no `R` for a JSX page (found while building the router typing; the spike had tested plain Effects only). The analyzer reads `startRouter` and `handle` as roots: each page's render and loaders, and the not-found page, are checked against the entry's layer plus the services the router supplies. A router it cannot read statically is reported `Unresolved`.
- **Naming (D3).** A server function is declared with `serverFn`; "Action" stays the Next Server Action and Form Action the ui submit handler.
- **Control flow (D4).** `start` depends on `@sleekstack/router`, because it hands pages to `handle`. Redirect and not-found are the router's own `Redirect` / `NotFound`, with no new vocabulary or shared leaf package.
- **Server functions.** `serverFn(id, { input, success, error? })(function* (input) {...})`. The body's failures are limited to the declared error and the router's `Redirect` / `NotFound` (a type error otherwise), and its services resolve in the Request Scope. Calling the function on the server runs the body with decoded input. Server functions are an explicit registry given to `start` as `functions`, not found by a compiler: a `'use server'` transform is the hardest part of Next to copy, and a list keeps every function analyzable. Duplicate ids fail `start` with `DuplicateServerFn`, and ids outside `[A-Za-z0-9][A-Za-z0-9_.-]*` with `InvalidServerFnId`.
- **Client.** The client is typed from a contract, not from the server module. A contract is a plain `{ id, input, success, error? }` object in a module the browser may import; the server builds its function from it with `serverFn(contract.id, contract)(function* ...)`. `client(contract)` returns a stub that is an Effect-returning function and fails with the declared error, the router's `Redirect` / `NotFound` (so a router action navigates), `NetworkError` or `DecodeError`. Given an `ActionEvent`, it decodes `formData` with the input Schema, so it is a form `action`, a `useAction` argument and a router `action` with no adapter. The spec's R6 says "typed from the server module with a type-only import"; what was built is typed from the contract the server function is built from. Both sides read the same Schemas and the browser never imports the body. A showcase bundle test proves that no server module or server Layer reaches the client chunk.
- **Wire (D6).** `POST /_sleek/fn/<id>` with the Schema-encoded input as JSON (an empty body is `undefined`, for a `Schema.Void` input). The checks run in this order, all before the body: method (405, `Allow: POST`), origin (403), registered id (an empty 404 that names no ids), body size (413, default 1 MiB), JSON (400) and the input Schema (400 `DecodeError` with one issue per field). The response is an Exit-shaped envelope with no other fields:
  - `{ _tag: 'Success', value }`, 200, encoded with the success Schema, so fields outside it are not serialized
  - `{ _tag: 'Failure', error }`, 200, for the declared error
  - `{ _tag: 'Redirect', to }`, 302 with no `Location`, so `fetch` hands it to the stub instead of following it
  - `{ _tag: 'NotFound' }`, 404
  - an undeclared failure or a defect: the error sink, then an empty 500

  An unknown envelope reads back as `DecodeError`. There are no streaming results.

- **Origins and CORS.** Every server-function call passes a same-origin check. The request's own origin passes, and so does each entry in `origins`. With no `Origin` header only `Sec-Fetch-Site: same-origin` passes, and the check cannot be turned off. `start` validates each entry as a bare origin (case, a trailing slash and a default port normalized; anything else, including what URL parsing would fold into a bare origin, fails with `InvalidOrigin`). `origins` only lets a call run: the framework sends no CORS headers, and the app owns them in middleware through `ResponseHeaders`.
- **Testing.** `@sleekstack/testing` has `callServerFn(fn, input, { layer, headers? })`, which resolves to an `Exit`, and `callHandler(handler, request, { layer })`, which resolves to a `Response`. Both run through `start(...).fetch` with a test layer and no network.

## Consequences

- One `fetch` serves a whole app on any host that speaks web `Request` / `Response`. The showcase mounts it as Vite dev-server middleware.
- Every stage gets Layers, the Request Scope, the error sink and the control-flow classifier from `@sleekstack/runtime`, which stays Schema-free (ADR 0013). Pages, their loaders included, run on the request fiber's runtime (`handle`'s `runtime` option), so they see its FiberRefs, tracer and devtools scope.
- The router gives `Route` to matched pages only, so a not-found page that reads `Route` needs it from the entry's layer, in types and in `sleekstack check` alike.
- Known gaps:
  - Route handlers match exact pathnames only, with no params.
  - A `Redirect` or `NotFound` from middleware or a handler answers a 302 or an empty 404, not the router's not-found page.
  - Each `start` call configures the process-wide runtime, so the testing helpers replace the configured runtime on each call.

## Rejected

- A `'use server'` compiler transform: the hardest part of Next to copy, the least needed when types cross through shared Schemas, and it hides the registry from the analyzer.
- Typing the client from the server module with `import type`: the stub needs the Schemas at runtime to encode and decode, so a type-only import is not enough, and importing the server module would pull its body into the client chunk.
- Server functions in `@sleekstack/runtime`: it stays framework-agnostic and Schema-free (ADR 0013).
- A shared leaf package for `Redirect` / `NotFound`: start already depends on the router.
- A custom binary wire format, and streaming results.
- The analyzer as the only boundary: types reject loaders and plain-Effect pages without running the CLI; the analyzer covers what types cannot see (JSX).
- CORS headers from `origins`: an allow-list for calls is not a CORS policy, and middleware already owns response headers.
