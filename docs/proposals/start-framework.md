# Proposal: SleekStack Start, the full-stack framework for `@sleekstack/ui` (the Next.js counterpart)

Status: draft for discussion. D1 to D4 and D6 are decided in [ADR 0039](../adr/0039-start-server-core.md) (spec fn-54); the other "Decisions to take" each become an ADR before building (AGENTS.md).
Date: 2026-10-17. Name: `@sleekstack/start` (decided).

Note (fn-55, ADR 0049): `@sleekstack/kit`, `@sleekstack/next`, `@sleekstack/react` and `@sleekstack/islands` are removed; mentions of them below record the state when this was written.

## 1. Premise

Next.js is React plus a router, a server rendering model (RSC), Server Actions, route handlers, middleware, a dev server and build, and deploy targets. `@sleekstack/ui` already has the React-equivalent half: a host-first component model, SSR, streaming, hydration, resume, router, forms, transitions, testing and devtools. What it lacks is the framework around it: nothing wires those pieces into one app with a server, and nothing lets a component call the backend.

Goal: `@sleekstack/start`, an opinionated meta-framework for `@sleekstack/ui` apps. One project, file-based routes, loaders and server functions on the existing Effect runtime, one request handler that deploys anywhere, dev and build through Vite. Not a fork of Next: it takes the capabilities, not the compiler.

## 2. What exists, what is missing

| Next.js capability | Already in SleekStack | Missing |
| --- | --- | --- |
| Router, params, links, prefetch | `@sleekstack/router` (const table, typed params, `Link`) | file-based discovery (fn-29 R3), nested layouts (none in the router API I read) |
| Data loading | router `loader` / `useLoader`, `Transfer` | loader invalidation, caching policy |
| SSR and streaming | `renderToString`, `renderToStream` (ADR 0023), router `handle` | a deployable server entry around it |
| Selective client JS | hydrate, resume (ADR 0017), lazy | per-route choice between them |
| Server Actions | form `action` + `useAction` (ADR 0033), runs **in the browser** | a server RPC, no-JS form posts |
| Route handlers (API routes) | none | `(Request) => Response` endpoints with services |
| Middleware | none | request pipeline (auth, redirects, headers) |
| `cookies()` / `headers()` | none (Next's work only under `kit/next`) | request services in the Request Scope |
| Metadata | `Head` specified, not built (fn-33) | everything |
| Build, dev server, HMR | specified: Vite plugin (fn-29), HMR (fn-31) | not built |
| Static export / SSG | specified (fn-30) | not built |
| Deploy adapters | none | node, edge, serverless adapters |
| Env, config | none | Schema-validated env |
| Image / font / i18n | none | out of scope, see 12 |

Backend runtime, DI, per-request scope, devtools events and the analyzer already exist (`@sleekstack/runtime`, kit, `sleekstack check`) and are the advantage Next does not have.

## 3. The rendering model (the RSC question)

Next splits components into server and client by a directive. We do not copy RSC: ui components are Effect programs that already can `yield*` a service while rendering on the server.

Proposed model, per route:

1. **Hydrated (default).** Server renders (string or stream), the browser re-runs components against the same atoms and `Transfer` data (ADR 0016, 0023).
2. **Resumed (opt-in).** Components never re-run in the browser; handlers and bound text resume from a manifest (ADR 0017). Measured entry 78 KB gzip, almost all of it Effect, so worth it only when a page already ships Effect. Status of that ADR is still "Proposed (spike)".
3. **Static.** Prerendered at build (fn-30).

Where does server-only code live? Loaders and server functions, never inside a hydrated component body, because the component re-runs in the browser where the service does not exist. The enforcement is types, not a directive: no `'use client'` / `'use server'` strings.

**D2 spike result (2026-10-17, run against master):**

- A server-only `yield* Db` in a plain-Effect component, with a client layer that lacks `Db`, is a **TypeScript error** at `mount`, `hydrateMount`, `renderToString` and `renderToStream` (`Layer<never>` is not assignable to `Layer<Db>`). Correction (fn-54): this holds for plain Effects only. ui types JSX as requirement-free, so a JSX component that needs `Db` compiles under a client layer; the compiler does not enforce the boundary for JSX, and `sleekstack check` does (ADR 0039).
- The analyzer (`sleekstack check`) reads **only `mount` and `resume`** as roots; the other three are not trees. Making them roots is a one-line change to the callee list in `packages/analyze/src/components.ts` (tried: it then reports `MissingDependency` for all four), but it adds nothing for direct calls, which `tsc` already rejects.
- **The router erases the check.** `Page.render` is `Effect<Node, any, any>` and `startRouter`/`handle` take `layer?: Layer<any, any, never>`, so a page that needs `Db` under `startRouter` passes `tsc` and is not an analyzer root. That is the path every Start app uses, so it is the gap to close.
- Fix, in order of preference: (a) make `Router`, `Page` and the entries generic over the page requirements `R`, so `startRouter(router, { layer })` must provide them; the client entry then cannot provide server services and `tsc` rejects the page. (b) Add `startRouter` / `handle` as analyzer roots reading the same types. (a) is smaller and works without running the CLI. Outcome (ADR 0039): both were built, (a) for loaders and plain-Effect pages, (b) for JSX pages, which (a) cannot see.
- Not tested: a server-only service legitimately used by a loader (loaders run on the server first, then their data travels through `Transfer`; on client navigation they re-run in the browser, so a server-only loader needs a server function, not a direct `yield*`). This needs its own case in phase 1.

## 4. App shape

```
app/
  routes/
    index.tsx                 -> '/'
    users/[id].tsx            -> '/users/:id'
    api/health.ts             -> route handler
  layout.tsx                  -> root layout (nesting is D5)
  middleware.ts
  server.ts                   -> layers, functions, config
  client.ts                   -> startRouter entry (generated by default)
```

A route file exports named parts, all optional except `page`:

```tsx
export const loader = loaderOf(...)             // router loader (ADR 0036)
export const page = () => ...                   // ui component
export const head = ...                         // fn-33
export const rename = serverFn(...)             // 5
export const prerender = () => [...]            // fn-30
```

The Vite plugin (fn-29) turns the folder into the same const route table and typed params `@sleekstack/router` uses today; there is no second router and no codegen tree beyond that table.

## 5. Server functions (the Actions counterpart)

Declared once on the server, called from ui with end-to-end types. Replaces nothing in `kit/next` (that stays the Next path).

```ts
export const rename = serverFn('profile.rename', {
  input:   Schema.Struct({ name: Schema.NonEmptyString }),
  success: Schema.Struct({ id: Schema.String, name: Schema.String }),
  error:   NameTaken,                          // Schema.TaggedError: typed across the wire
})(function* ({ name }) {
  const user = yield* Session                  // Tags resolve in the Request Scope
  if (!user) return yield* redirect('/login')  // the router's control flow
  return yield* Profiles.rename(user.id, name)
})
```

- **Transport.** `POST /_sleek/fn/<id>`, JSON of Schema-encoded input, `Exit`-shaped response: success, typed failure, control-flow envelope (redirect, not-found), 400 `DecodeError`, opaque 500 for defects (no stack or message in production).
- **Client.** Stubs are Effects. Decided in ADR 0039: `client(contract)` is typed from a client-safe contract (`{ id, input, success, error? }`) that the server function is built from, not from the server module with `import type`, because the stub needs the Schemas at runtime. They plug into `<form action>`, `useAction`, router `action` and the Draft's `toDto()` with no adapter. The client imports the contract's Schemas, never the server module; a bundle test (ADR 0022 style) proves no server code or Layer graph reaches the client chunk.
- **No-JS forms.** A `<form method="post" action="/_sleek/fn/<id>">` posts urlencoded data, decoded by the same Schema, then redirects (post/redirect/get) and `handle` re-renders. ADR 0033 deferred this; Start is where it belongs.
- **Freshness.** A function declares `invalidates`: router loader keys and TanStack query keys. The success envelope carries them and the client stub re-runs matching loaders and calls `invalidateQueries`. There is no server data cache (CONTEXT: Query caches nothing), so this is a client hint, not `revalidatePath`.
- **Security defaults.** Same-origin check; only registered ids callable (unknown id 404, no enumeration); input decoded before the body runs; output encoded, so extra fields are not serialized; no closure capture; body size limit.
- **Why explicit, not a `'use server'` transform.** The compiler transform is the hardest part of Next to copy and the least needed here, since types cross via `import type`. An explicit registry lets `sleekstack check` list every function with its `R` and `E` and verify each resolves in the runtime graph. A Vite stub generator is phase 3 sugar.

## 6. Route handlers and middleware

Both are Effects on the same runtime, so they get Layers, the Request Scope, devtools and the analyzer for free.

```ts
// app/routes/api/health.ts
export const GET = handler(function* (req) { return Response.json(yield* Health.check()) })

// app/middleware.ts: an ordered list, each (req) => Effect<void | Response>
export default [cors, requireSession({ only: '/admin/*' })]
```

Request services provided per call, replaceable in tests with `mockLayer`: `Request` (read-only method, url, headers), `Cookies` (`get`/`set`/`delete`, sets become `Set-Cookie`), `ResponseHeaders`. These are plain Tags; kit modules depend on them like any service.

Built differently: file-routed handlers are Controllers ([ADR 0053](../adr/0053-file-routed-controllers.md), spec fn-68). A `*.controller.ts` file under `server/routes` sets its URL from its path, its methods are plain Effect functions of decoded `{ params?, query?, body? }` typed by their written-out signature, `ResponseStatus` joins the request services, and a `_defaults.ts` file's `wrap` runs around every Controller below its directory.

## 7. One server entry, any host

```ts
export default start({ router, layer, functions, handlers, middleware })
// -> { fetch(request: Request): Promise<Response> }
```

Web-standard `Request`/`Response`, like `handle` today. Order: static assets, middleware, `/_sleek/fn/*`, route handlers, router `handle` (page). [ADR 0053](../adr/0053-file-routed-controllers.md) puts Controllers between route handlers and the page, makes `router` optional, and lets `start()` with no options serve the app the Vite plugin discovers. It uses `runEffect` from `@sleekstack/runtime` for every call, so the `onError` sink, `isControlFlow`, devtools events and request scope apply unchanged.

Adapters are thin: Vite dev middleware (first), Node (`http`), Workers/edge, Vercel. Each is `fetch` plus how static files are served; no adapter owns logic.

## 8. Build, dev, tooling

Not new designs, already specified, listed here because Start depends on them:

- fn-29 Vite plugin: JSX, analyzer overlay, file routes, SSR/client entries, stable component ids.
- fn-33 Head. fn-30 SSG. fn-31 HMR that keeps state.
- CLI: `sleekstack dev | build | start | check`; `check` already exists, the rest wrap Vite and the server entry.
- Devtools: server-function calls and middleware appear in the existing runtime event buffer and `UiPanel`.

## 9. Relation to existing packages

- `@sleekstack/ui`: unchanged. Start imports its public API; ui never imports Start (ADR 0025 and 0036 boundary).
- `@sleekstack/router`: stays the routing library. Start adds file discovery and, if D5 says so, layouts. `Redirect` and `NotFound` are the shared control flow (D4 for where they live).
- `@sleekstack/runtime` and kit: unchanged; Start is another consumer of `runEffect`.
- `@sleekstack/kit/next`, `@sleekstack/next`: stay for Next users.
- `@sleekstack/testing`: gains `callServerFn(fn, input, { layer })` and a request helper for handlers, no HTTP.

## 10. Decisions to take (each gets an ADR)

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Packaging (name decided: `@sleekstack/start`) | Decided, [ADR 0039](../adr/0039-start-server-core.md): `@sleekstack/start` depends on `@sleekstack/runtime`, with `@sleekstack/router` and `@sleekstack/ui` as peers; `@sleekstack/ui-vite` (fn-29) for build. Not a rename of `sleekstack` the CLI. |
| D2 | Server/client boundary | Decided, [ADR 0039](../adr/0039-start-server-core.md): no directives; `Router<T, R>` types loaders and plain-Effect pages, and `sleekstack check` reads `startRouter` / `handle` as roots for JSX pages, which ui types as requirement-free. A server-only loader is a server function. |
| D3 | Server function vs "Action" naming | Decided, [ADR 0039](../adr/0039-start-server-core.md): `serverFn`, the Server Function in CONTEXT.md. "Action" already means three things in this repo. |
| D4 | Where `Redirect`/`NotFound` live | Decided, [ADR 0039](../adr/0039-start-server-core.md): `start` depends on `@sleekstack/router` (it hands pages to the router's `handle`), so it uses the router's own errors. No leaf package. |
| D5 | Layouts | Add nested layouts to the router (a route's `layout` chain) rather than only a Start convention, since `startRouter` must swap the same pieces. Needs its own router ADR. |
| D6 | Wire protocol | Decided, [ADR 0039](../adr/0039-start-server-core.md): JSON of Schema-encoded values, `Exit`-shaped envelopes. No streaming results in v1. |
| D7 | Default rendering mode | Hydrated; resume is opt-in until ADR 0017 leaves "Proposed". |
| D8 | Auth | Not in the framework: a `Session` Tag provided by the app, a guard is `yield* Session`. |

## 11. Phases

0. **Land what is specified:** fn-29, fn-33, fn-30 (HMR fn-31 last). Start does not duplicate any of it.
1. **Server core (one spec, ADR for D1-D4, D6):** `start({ ... })` entry, `serverFn` + client + wire, route handlers, middleware, request services, same-origin check, `callServerFn`. Showcase gets a Vite-dev-server page where "add todo" runs on the server. Tests: wire round trip, decode failure, defect hiding, origin rejection, unknown id, bundle test for the client chunk.
2. **Framework glue:** file routes feeding `start`, layouts (D5), `invalidates`, no-JS form posts, analyzer rows (list functions and handlers, check `R`/`E`), `sleekstack dev|build|start`.
3. **Deploy and polish:** node and edge adapters, Schema-validated env, Vite stub generator for server functions, per-route resume opt-in, size budget row (ADR 0022).

## 12. Non-goals

- A `'use server'` compiler, closure capture, or RSC.
- A server data cache or ISR (no equivalent of the Next Data Cache).
- Image, font and i18n optimization: Next-specific products, separate proposals if wanted.
- Replacing `kit/next` or the Next adapters.
- Streaming results, WebSockets, subscriptions.
- An auth, session or rate-limit framework.

## 13. Risks and open questions

- **Scope.** This is a framework, not a feature: phases 0-1 are four to six specs. Phase 1 is the smallest slice that proves the idea; everything after depends on how it feels.
- **Hydration re-runs components** (section 3). Direct entries type-check plain-Effect components only; JSX is checked by `sleekstack check`, which reads the router entries as roots since fn-54 (ADR 0039).
- **Layouts** are not in the router today; partial navigation (keep the layout, swap the page) touches the reconciler.
- **Known bugs on the path:** after `hydrateMount`, text bound directly to an atom stays at the server value (`hydrate.ts`, `adoptOne`), and the analyzer did not read `Link` from the router (fixed in fn-54). The first affects an SSR framework's default demo and should be fixed before Phase 2.
- **React guests:** the stubs are Effects, so React guests could call them via `@sleekstack/react`; not checked.
- **Stale tabs:** a renamed function id is a 404. Acceptable in v1; a typed `Outdated` error later.
- **Batching:** several calls in one tick could share a POST; same wire shape, deferred.
