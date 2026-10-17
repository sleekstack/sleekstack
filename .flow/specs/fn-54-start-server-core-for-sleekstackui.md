## Conversation Evidence

- [user] "work on a proposal for backend specific functionality above sleekstack counterpart to nextjs and it's actions"
- [user] "it should be a counterpart to next, but instead of react it's for sleekstack/ui"
- [user] "use start" (the package is `@sleekstack/start`)
- [user] "run the D2 spike" (result: the compiler already enforces the server/client boundary for direct mounts; the router erases it)
- [user] "capture phase 1 as a spec" (phase 1 of the Start proposal, `docs/proposals/start-framework.md`)

## Goal & Context
<!-- scope: business -->

Apps on the `@sleekstack/ui` host have no server counterpart to what Next.js gives React: a component cannot call the backend, there are no route handlers or middleware, and nothing wires the router, SSR and the Effect runtime into one deployable request handler. [paraphrase]

Phase 1 of `@sleekstack/start` is the smallest slice that proves the idea: one request handler that serves pages, server functions (the Server Actions counterpart), route handlers and middleware on the existing runtime, with end-to-end types from server to ui. File-based routes, layouts, no-JS form posts, invalidation, deploy adapters and the Vite plugin come later (the proposal's phases 0, 2 and 3). [paraphrase]

Prerequisite found by the D2 spike: the router erases page requirements, so a server-only service used by a page passes type checking under the client entry. This spec closes that first, because the server/client boundary depends on it. [paraphrase]

## Architecture & Data Models
<!-- scope: technical -->

- New package `@sleekstack/start`. `@sleekstack/ui` never depends on it; it uses ui's public API (ADR 0025 and 0036 boundary). [paraphrase]
- Every call (page, server function, route handler) runs through `@sleekstack/runtime` in a Request Scope, so the error sink, control-flow classifier and devtools events apply unchanged. [paraphrase]
- Server/client boundary is enforced by types where they exist (loaders and plain-Effect pages) and by `sleekstack check` for JSX pages, since ui types JSX as requirement-free (found while implementing the router typing); no `'use client'` / `'use server'` directives: server-only services are absent from the client layer, so a page that needs one fails to compile under the client entry. [paraphrase]
- Server functions are an explicit registry given to the entry, not discovered by a compiler. The client imports types only. [paraphrase]
- `@sleekstack/kit/next` and `@sleekstack/next` are unchanged. [paraphrase]
- `start` depends on `@sleekstack/router` (it hands pages to the router's server entry), so redirect and not-found are the router's own tagged errors, not a new vocabulary. Confirmed against the router source; the earlier idea of a shared leaf package is dropped. [paraphrase]

## API Contracts
<!-- scope: technical -->

- **Entry:** `start({ router, layer, functions, handlers, middleware })` returns an object with `fetch(request): Promise<Response>`. Dispatch order: middleware, server functions, route handlers, router page. [paraphrase]
- **Server function:** declared with an id, an input Schema, a success Schema, an optional tagged-error Schema and a generator body whose requirements resolve in the Request Scope. Directly callable on the server with the decoded input. [paraphrase]
- **Wire:** `POST` to a fixed path prefix plus the id; body is the Schema-encoded input as JSON; the response is Exit-shaped: success value, typed failure, control-flow envelope (redirect, not-found), 400 `DecodeError`, or an opaque 500 for a defect (no message or stack in production). [paraphrase]
- **Client:** stubs derived from the server module's type are Effects failing with the declared error, `NetworkError` or `DecodeError`. [paraphrase]
- **Route handler:** one function per HTTP method, an Effect over the request returning a `Response`. **Middleware:** an ordered list; each continues or short-circuits with a `Response`. [paraphrase]
- **Request services (Tags):** `Request` (read-only), `Cookies` (`get`, `set`, `delete`; sets become `Set-Cookie`), `ResponseHeaders`. [paraphrase]

## Edge Cases & Constraints
<!-- scope: technical -->

- Security defaults: same-origin check on every server-function call, only registered ids callable, input decoded before the body runs, output encoded so extra fields are not serialized, no closure capture, a body size limit. [paraphrase]
- A server-only loader cannot be a direct service read: on client navigation loaders re-run in the browser (confirmed in ADR 0036), so server-only work behind a loader goes through a server function. [paraphrase]
- Resumed routes (ADR 0017, still Proposed) are not part of this phase. [paraphrase]
- Streaming results from server functions are not supported (as with `kit/next`). [paraphrase]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** The router tracks page, loader and not-found requirements as a type parameter; the browser entry and `handle` require a layer providing them. A loader or a plain-Effect page needing a service absent from the client layer fails type checking; one needing a service the layer provides compiles. A server-only service read directly by a loader that re-runs in the browser is a type error. Errors: existing router apps whose pages have no requirements compile unchanged; JSX pages are not covered by the compiler (ui types JSX as requirement-free) and are checked by R12. [paraphrase]
- **R2:** `start(...)` returns a `fetch` handler dispatching middleware, then server functions, then route handlers, then the router page, every call through the runtime in a Request Scope. Errors: an unmatched path renders the router's not-found page with 404; a defect in any stage reaches the runtime error sink and answers 500 with no internals in production. [paraphrase]
- **R3:** A server function validates its input Schema before the body runs and encodes its output with the success Schema, so fields outside the Schema are not serialized. Errors: invalid input → 400 `DecodeError` with field-level detail and the body is not run; a declared tagged error crosses the wire typed; an undeclared failure or defect → opaque 500; duplicate ids or an id outside the allowed characters fail at `start(...)` with a named error. [paraphrase]
- **R4:** Wire behavior: only `POST` to a registered id runs a function. Errors: other methods → 405; unknown id → 404 without listing known ids; malformed JSON → 400; body over the size limit → 413. [paraphrase]
- **R5:** The same-origin check rejects a cross-origin call with 403 before decoding; configured allowed origins pass. Errors: a missing `Origin` header on a non-same-site request is rejected; the check cannot be disabled by omission. [paraphrase]
- **R6:** The client stub is an Effect typed from the server module with a type-only import; it works unchanged as a form `action`, with `useAction` and as a router `action`. Errors: a network failure → `NetworkError`; a response that fails its Schema → `DecodeError`; a redirect or not-found envelope navigates through the router's control flow. [paraphrase]
- **R7:** Route handlers run per HTTP method as Effects with the request services; middleware runs in order and a short-circuit `Response` skips everything after it. Errors: an unsupported method → 405 with `Allow`; a failing middleware or handler → 500 via the error sink. [paraphrase]
- **R8:** `Request`, `Cookies` and `ResponseHeaders` are Tags provided per call and replaceable with a test layer. Errors: a cookie name or value that is invalid per the cookie grammar is rejected with a typed error rather than emitted. [paraphrase]
- **R9:** Redirect and not-found raised in a server function, handler or middleware answer 302 / 404 on the wire and are the router's own `Redirect` / `NotFound` values, so a client stub failing with one navigates through the router. Errors: a redirect loop is bounded as in the router; an unknown control-flow envelope is a `DecodeError`. [paraphrase]
- **R10:** `@sleekstack/testing` can call a server function and a handler with a test layer and a request, without HTTP. Errors: no error surface beyond R3 and R7 behavior. [paraphrase]
- **R11:** The showcase app has a page where a form adds an item through a server function served by the dev server, with a test; a bundle test proves the client chunk contains no server module and no server Layer graph. ADR(s) record the decisions (name, packaging, boundary, wire format), CONTEXT.md gains Server Function and Server Endpoint, and AGENTS.md gets a verify row for the new package. Errors: no error surface beyond the tests failing the build. [paraphrase]
- **R12:** `sleekstack check` treats `startRouter` and `handle` as roots: each page's render, its loaders and the not-found page are checked against the entry's layer plus the services the router supplies itself. A JSX page needing a service the layer lacks is reported as a missing dependency at that page, and the router's own `Link` is readable. Errors: a router the analyzer cannot read statically is reported as unresolved, never skipped silently; a page needing nothing, or whose needs the layer provides, reports nothing. [paraphrase]

## Boundaries
<!-- scope: business -->

- No file-based routes, nested layouts, no-JS form posts or `invalidates` (proposal phase 2). [paraphrase]
- No deploy adapters beyond what the showcase dev server needs, no Vite stub generator, no per-route resume opt-in (phase 3). [paraphrase]
- No `'use server'` compiler, closure capture, RSC, server data cache, streaming results, WebSockets, or auth/session framework. [paraphrase]
- `@sleekstack/kit/next` and the Next adapters are not changed or replaced. [paraphrase]

## Decision Context
<!-- scope: both -->

Why this slice: it is the smallest that exercises the whole path (type boundary, entry, wire, client, runtime scope) and is the one the later phases build on. [paraphrase]

Rejected: a compiler transform for server functions (hardest part of Next to copy, least needed since types cross through type-only imports; an explicit registry also keeps the functions analyzable); a custom binary wire format; adding server functions to `@sleekstack/runtime` (it stays Schema-free and framework-agnostic, ADR 0013); making the analyzer the boundary (the D2 spike showed the compiler already rejects direct calls, so the router's lost types are the gap). [paraphrase]

Source: `docs/proposals/start-framework.md`, sections 3, 5 to 7, 10 and 11.


## Quick commands

```bash
pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=showcase
```

## Early proof point

Tasks fn-54-start-server-core-for-sleekstackui.1 and .7 validate the server/client boundary (a page's requirements must be provided by the client layer: types for loaders and plain Effects, the analyzer for JSX). If it fails, re-evaluate the type-enforced server/client model (proposal D2) before continuing with the rest.


## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | The router tracks page, loader and not-found requirements as a type parameter; the browser entry and `handle` require a layer providing them. A loader or a plain-Effect page needing a service absent from the client layer fails type checking; one needing a service the layer provides compiles. A server-only service read directly by a loader that re-runs in the browser is a type error. Errors: existing router apps whose pages have no requirements compile unchanged; JSX pages are not covered by the compiler (ui types JSX as requirement-free) and are checked by R12. | fn-54-start-server-core-for-sleekstackui.1 | — |
| R2 | `start(...)` returns a `fetch` handler dispatching middleware, then server functions, then route handlers, then the router page, every call through the runtime in a Request Scope. Errors: an unmatched path renders the router's not-found page with 404; a defect in any stage reaches the runtime error sink and answers 500 with no internals in production. | fn-54-start-server-core-for-sleekstackui.2 | — |
| R3 | A server function validates its input Schema before the body runs and encodes its output with the success Schema, so fields outside the Schema are not serialized. Errors: invalid input → 400 `DecodeError` with field-level detail and the body is not run; a declared tagged error crosses the wire typed; an undeclared failure or defect → opaque 500; duplicate ids or an id outside the allowed characters fail at `start(...)` with a named error. | fn-54-start-server-core-for-sleekstackui.3 | — |
| R4 | Wire behavior: only `POST` to a registered id runs a function. Errors: other methods → 405; unknown id → 404 without listing known ids; malformed JSON → 400; body over the size limit → 413. | fn-54-start-server-core-for-sleekstackui.3 | — |
| R5 | The same-origin check rejects a cross-origin call with 403 before decoding; configured allowed origins pass. Errors: a missing `Origin` header on a non-same-site request is rejected; the check cannot be disabled by omission. | fn-54-start-server-core-for-sleekstackui.3, fn-54-start-server-core-for-sleekstackui.8 | — |
| R6 | The client stub is an Effect typed from the server module with a type-only import; it works unchanged as a form `action`, with `useAction` and as a router `action`. Errors: a network failure → `NetworkError`; a response that fails its Schema → `DecodeError`; a redirect or not-found envelope navigates through the router's control flow. | fn-54-start-server-core-for-sleekstackui.4 | — |
| R7 | Route handlers run per HTTP method as Effects with the request services; middleware runs in order and a short-circuit `Response` skips everything after it. Errors: an unsupported method → 405 with `Allow`; a failing middleware or handler → 500 via the error sink. | fn-54-start-server-core-for-sleekstackui.2 | — |
| R8 | `Request`, `Cookies` and `ResponseHeaders` are Tags provided per call and replaceable with a test layer. Errors: a cookie name or value that is invalid per the cookie grammar is rejected with a typed error rather than emitted. | fn-54-start-server-core-for-sleekstackui.2 | — |
| R9 | Redirect and not-found raised in a server function, handler or middleware answer 302 / 404 on the wire and are the router's own `Redirect` / `NotFound` values, so a client stub failing with one navigates through the router. Errors: a redirect loop is bounded as in the router; an unknown control-flow envelope is a `DecodeError`. | fn-54-start-server-core-for-sleekstackui.3, fn-54-start-server-core-for-sleekstackui.4 | — |
| R10 | `@sleekstack/testing` can call a server function and a handler with a test layer and a request, without HTTP. Errors: no error surface beyond R3 and R7 behavior. | fn-54-start-server-core-for-sleekstackui.6 | — |
| R11 | The showcase app has a page where a form adds an item through a server function served by the dev server, with a test; a bundle test proves the client chunk contains no server module and no server Layer graph. ADR(s) record the decisions (name, packaging, boundary, wire format), CONTEXT.md gains Server Function and Server Endpoint, and AGENTS.md gets a verify row for the new package. Errors: no error surface beyond the tests failing the build. | fn-54-start-server-core-for-sleekstackui.5, fn-54-start-server-core-for-sleekstackui.6 | — |
| R12 | `sleekstack check` treats `startRouter` and `handle` as roots: each page's render, its loaders and the not-found page are checked against the entry's layer plus the services the router supplies itself. A JSX page needing a service the layer lacks is reported as a missing dependency at that page, and the router's own `Link` is readable. Errors: a router the analyzer cannot read statically is reported as unresolved, never skipped silently; a page needing nothing, or whose needs the layer provides, reports nothing. | fn-54-start-server-core-for-sleekstackui.7 | — |
