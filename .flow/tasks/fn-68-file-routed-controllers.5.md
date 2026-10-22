---
satisfies: [R6, R7, R9, R15]
---
# fn-68-file-routed-controllers.5 start: ResponseStatus, routing failures, wrap types and the Controller dispatcher

Touches: [packages/start/src/**, packages/router/src/index.ts, packages/router/src/__tests__/**, packages/router/README.md]

## Description
Add the request-service and failure vocabulary of ADR 0053 and the dispatcher that serves a Controller entry: matching, method handling, defaults and the routing failures. It takes hand-built entries, so it is testable without the plugin.

**Size:** M
**Files:** `packages/start/src/services.ts`, `packages/start/src/controller.ts` (new), `packages/start/src/handler.ts`, `packages/start/src/start.ts`, `packages/start/src/index.ts`, `packages/start/src/__tests__/` (new `controller-dispatch.test.ts`, services and `implement.test-d.ts`), `packages/router/src/index.ts`, `packages/router/README.md`

### Approach
- `ResponseStatus` Tag with `set(n)` (a defect `InvalidStatus` outside integers 200 to 599), joined to `RequestServices` (`services.ts:41,88-117`; `Needs` and `implement` widen automatically). State is per request; it is read only by the Controller face. Tests: two concurrent requests with different statuses do not cross; a status set then a failure keeps headers and cookies and drops the status (memory `start-request-services-set-cookie`: every response goes through `finish`).
- Failure classes `InvalidPathEncoding`, `MethodNotAllowed` (carries the allowed methods), `BodyTooLarge`, `UnsupportedMediaType`, and the exported `Wrap` and `RpcWrap` authoring types, with TSDoc for each (`api-coverage`).
- Matcher: export `segments` and `bind` from the router (public export: run the fixture graph check before and after) and build the Controller matcher on them with R15's rule (a malformed escape binds only at param or splat positions and fails when decoded; a static position never matches it). Order comes from the entry list, which the plugin sorts.
- Dispatch inserted between the exact-pathname handler and the page (`start.ts:98-104`): the request method is upper-cased; `HEAD` runs `GET` and drops the body outermost (cancelling a streaming body); default `OPTIONS` answers 204 with `Allow` inside `wrap`; `Allow` lists served methods in canonical order including the implicit ones; `MethodNotAllowed` otherwise. Unhandled answers: `InvalidPathEncoding` 404 with no body, `MethodNotAllowed` 405 with `Allow`; `Redirect` and `NotFound` stay control flow (`start.ts:57,104-111`).

### Investigation targets
**Required** (read before coding):
- `packages/start/src/services.ts:41,88-117`
- `packages/start/src/start.ts:96-113`
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
