---
satisfies: [R6, R7, R9, R15]
---
# fn-68-file-routed-controllers.5 start: ResponseStatus, routing failures, wrap types and the Controller dispatcher

Touches: [packages/start/src/**, packages/router/src/index.ts, packages/router/src/__tests__/**, packages/router/README.md]

## Description
Add the request-service and failure vocabulary of ADR 0053 and the dispatcher that serves a Controller entry: matching, method handling, defaults and the routing failures. It takes hand-built entries (`ControllerEntry` of `packages/start/src/app.ts`, task 1) through a new `StartOptions.controllers` (`readonly ControllerEntry[]`, merged after the discovered entries, so an explicit entry never reorders them), so it is testable without the plugin. Task 6 and task 9's `callController` reuse that option.

**Size:** M
**Files:** `packages/start/src/services.ts`, `packages/start/src/controller.ts` (new), `packages/start/src/handler.ts`, `packages/start/src/start.ts`, `packages/start/src/index.ts`, `packages/start/src/__tests__/` (new `controller-dispatch.test.ts`, services and `implement.test-d.ts`), `packages/router/src/index.ts`, `packages/router/README.md`

### Approach
- `ResponseStatus` Tag with `set(n)` (a defect `InvalidStatus` outside integers 200 to 599), joined to `RequestServices` (`services.ts:41,88-117`; `Needs` and `implement` widen automatically). State is per request; it is read only by the Controller face. Tests: two concurrent requests with different statuses do not cross; a status set then a failure keeps headers and cookies and drops the status (memory `start-request-services-set-cookie`: every response goes through `finish`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 made the analyzer recognize a request service by its declaration, `start/services#<name>` (`REQUEST_SERVICES` of `packages/analyze/src/controllers.ts`), so `ResponseStatus` must be a class declared in `packages/start/src/services.ts` itself, beside `Request`, `Cookies` and `ResponseHeaders`; a Tag declared in another file, or only re-exported from `services.ts`, makes `sleekstack check` report `MissingDependency` for every Controller that uses it -->
- Failure classes `InvalidPathEncoding`, `MethodNotAllowed` (carries the allowed methods), `BodyTooLarge`, `UnsupportedMediaType`, and the exported `Wrap` and `RpcWrap` authoring types, with TSDoc for each (`api-coverage`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.4 made `sleekstack check` read the written call signature of a `wrap` export: the services in its `next` parameter's `R` that its result's `R` leaves out count as provided to the Controllers beneath it. A `wrap` whose `R` is generic, `any` or `unknown` (as a generic `Wrap` annotation gives) discharges nothing, so say in the TSDoc of `Wrap` that a `wrap` that provides a service writes its signature out, as the analyzer fixture `packages/analyze/src/__tests__/fixtures/controllers/server/routes/users/_defaults.ts` does -->
- Matcher: export `segments` and `bind` from the router (public export: run the fixture graph check before and after) and build the Controller matcher on them with R15's rule (a malformed escape binds only at param or splat positions and fails when decoded; a static position never matches it). Order comes from the entry list, which the plugin sorts.
- Dispatch inserted between the exact-pathname handler and the page (`start.ts:127-131`, inside `fetch` after the discovered app is awaited): the request method is upper-cased; `HEAD` runs `GET` and drops the body outermost (cancelling a streaming body); default `OPTIONS` answers 204 with `Allow` inside `wrap`; `Allow` lists served methods in canonical order including the implicit ones; `MethodNotAllowed` otherwise. Unhandled answers: `InvalidPathEncoding` 404 with no body, `MethodNotAllowed` 405 with `Allow`; `Redirect` and `NotFound` stay control flow (`start.ts:59,132-140`). <!-- Updated by plan-sync: fn-68-file-routed-controllers.1 made `fetch` await `discover()` first, which moved the start.ts references -->

### Investigation targets
**Required** (read before coding):
- `packages/start/src/services.ts:41,88-117`
- `packages/start/src/start.ts:97-141`
- `packages/start/src/handler.ts:3-19`
- `packages/router/src/index.ts:40-95` - segments, decode, bind, match
- `.flow/memory/bug/integration/start-request-services-set-cookie-2026-10-17.md`

**Optional**:
- `packages/router/src/__tests__/router.test.ts` - pins the page behaviour that must not change
- `.flow/memory/bug/security/url-canonicalization-folds-non-bare-2026-10-17.md`

## Acceptance
- [ ] page matching is unchanged (the router's malformed-escape tests pass untouched)
- [ ] tests through `fetch`: `%2F` and `%00` in a param, a malformed escape in a param (`InvalidPathEncoding`) and in a static position (falls to the page), `/a%2Fb/c` joins like `/a/b/c` in a splat, trailing slash, empty segment, lowercase `patch`, `HEAD` with and without `GET`, `OPTIONS` default and `Allow` string, `MethodNotAllowed`, a zero-method file
- [ ] `ResponseStatus` isolation and status-then-fail tests pass; `InvalidStatus` is a defect
- [ ] new exports have TSDoc and the fixture graph check diff is empty (or only the added exports)
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=@sleekstack/router...` passes

## Done summary
`start` now serves Controller entries passed in `start({ controllers })`. They come after the discovered ones, and the merged list is computed once with the discovered app. A Controller answers after the exact-pathname handler and before the page. The request services gain `ResponseStatus`. The routing failures and the `Wrap` and `RpcWrap` authoring types are exported with TSDoc.

- `ResponseStatus` is an `Effect.Tag` declared in `services.ts`, so `yield* ResponseStatus.set(201)` works. It joins `RequestServices`, which widens `Needs` and `implement` (type test in `implement.test-d.ts`). A value that is not an integer from 200 to 599 dies with `InvalidStatus`. `requestServices` keeps the status per request and returns `status()` beside `finish`. Only the Controller face reads it.
- `controller.ts` (new) holds the failures `InvalidPathEncoding`, `MethodNotAllowed { allowed }`, `BodyTooLarge` and `UnsupportedMediaType`, plus `matchController` and `serveController`.
  - The matcher is built on the router's `segments` and `bind`, which are now exported (README rows added). A malformed escape decodes to a lone surrogate, which a successful decode never yields. So it binds at a param or splat position and never at a static one (R15).
  - Inside the `wrap` chain (outermost first), the face checks, in order: the method (`HEAD` runs `GET` unless exported, `OPTIONS` answers 204 with `Allow` unless exported, otherwise `MethodNotAllowed`), then the escapes (`InvalidPathEncoding`), then runs the method.
  - Outside `wrap`, an unhandled `InvalidPathEncoding` answers 404, `MethodNotAllowed` answers 405 with `Allow`, `BodyTooLarge` 413 and `UnsupportedMediaType` 415. A `HEAD` answer's body is dropped outermost, and a streaming body is cancelled.
- `Wrap` is `(next: Effect<Response, any, any>, request) => Effect<Response, any, any>`, and `ControllerOptions.wrap` now uses it. Its TSDoc says that a `wrap` which provides a service must write its signature out, as the analyzer fixture `_defaults.ts` does. `RpcWrap` is `<A, E, R>(next: Effect<A, E, R>, request) => Effect<A, E, any>` (ADR 0054).
- Tests:
  - `controller-dispatch.test.ts` runs through `fetch` (table-driven): `%2F` and `%00` in a param, a malformed escape in a param or splat (empty 404) and in a static position (the page's not-found), `/files/a%2Fb/c` equal to `/files/a/b/c`, trailing slash, empty segment, lowercase `patch`, `HEAD` with and without `GET`, `OPTIONS` and `Allow`, 405, a zero-method file, and a handler winning over a Controller.
  - The same file covers: a streaming body cancelled on `HEAD`; routing failures, default `OPTIONS` and a `HEAD` drop of a `wrap` error body, all inside `wrap`; two concurrent statuses that do not cross; a status set and then a failure (wrap's status wins, staged header and cookie kept).
  - `start.test.ts` has a table for `InvalidStatus` at 199, 200, 599, 600 and 200.5.
  - Mutating the escape marker or sharing the status cell turned 5 tests red, then the code was restored.

Interim encoding for task 6 to replace: a returned `Response` passes through, and any other value is `Response.json(value, { status })`. The status defaults to 200, and the method gets `{ params }` as raw decoded strings. A `void` method therefore throws inside `Response.json` until task 6 adds R16. The unhandled 413 and 415 mappings exist, but nothing raises those failures yet.

Out of Touches, left for task 12: the docs snippet `apps/docs/snippets/server-services/profiles-session.server.ts` and the start README still list three request services.

Gates (post-edit):
- `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld`: green, 28/28 tasks, start 134 tests, router 86 (unchanged).
- `pnpm --filter realworld check`: green.
- docs `api-coverage.test.ts` after `generate:api`: green, 18 tests.
- Fixture graph check: the diff is empty.
- Baseline: green. The unittest gate reused its receipt and realworld check was run.

GATE_SKIPPED:unittest:green-receipt 07faa8d8 - baseline reused from prior post-gate pass

Tier: session (jev-unavailable(no_key)); routing block sets opus at medium (actual: claude-opus-5-5)

stage: impl-review - skipped(policy: user asked for one completion review at the end of the spec)
stage: plan-sync - ran (sonnet; updated tasks 6, 9, 12)
## Evidence
- Commits: 465aae15e0a1cd76b79ef25ebc880e57eaf7a411
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=realworld, pnpm --filter realworld check, (cd apps/docs && pnpm generate:api && npx vitest run test/api-coverage.test.ts), (cd packages/cli/src/__tests__/fixtures/effect-app && node ../../../../bin/cli.js check --json --entry runtime.ts) # before/after diff empty, GATE_SKIPPED:unittest:green-receipt 07faa8d8 - baseline reused from prior post-gate pass
- PRs: