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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
