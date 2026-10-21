---
satisfies: [R1]
---
# fn-67-realworld-on-server-services-request.1 start: `implement(Tag, methods)` with request services, per call on the wire and in process

## Description
The enabler everything else needs: an implementation Layer whose methods may use `Request`, `Cookies` and `ResponseHeaders`, proven on both call paths. It also settles the parked question in the spec (do `ResponseHeaders` writes other than `Set-Cookie` reach the page response from an in-process call) and records the answer in ADR 0052.

**Size:** M
**Files:** packages/start/src/service.ts or packages/start/src/implement.ts (new), packages/start/src/index.ts, packages/start/src/__tests__/implement.test.ts (new), packages/start/src/__tests__/implement.test-d.ts (new), packages/testing/src/__tests__/serverFn.test.ts, docs/adr/0052-server-service-request-services.md
**Touches:** [packages/start/src/**, packages/testing/src/__tests__/**, docs/adr/0052-server-service-request-services.md]

### Approach
- `implement(Tag, methods)`: `methods` has the Tag's contract shape but each method's `R` may be any subset of `RequestServices` (the union exported from `packages/start/src/services.ts`). Anything else in `R` is a type error at the call; pin it with a `.test-d.ts` and `@ts-expect-error`.
- It returns `Layer<Tag>` built from the methods as given (a cast is acceptable inside: the Tag's own type hides the requirement, as realworld's hand-written in-place layer does today). It lives in the server entry, never the `./client` subpath: check what `service.ts` imports so the client chunk still holds no server module.
- Wire path: `start`'s endpoint already runs each call in a Request Scope with the request services (`wire.ts` `run`), so a method's `Cookies` is that request's jar. Prove it end to end through `start(...).fetch`: a method that sets a cookie yields `Set-Cookie` on the response; a method reading a cookie sees the request's.
- In-process path: a page whose loader does `yield* Tag` and calls such a method runs on the request fiber's runtime (`handle`'s `runtime` option, `start.ts`), so the same services are present; prove a cookie set from a loader lands on the page response, and answer the `ResponseHeaders` question the same way. Record the finding in the ADR's Consequences.

### Investigation targets
**Required** (read before coding):
- `packages/start/src/service.ts` — `ServerService`, `ServerServiceShape`, the entry type and `taggedError`
- `packages/start/src/serverFn.ts:93-106` — `serviceFunctions`, how a method becomes a callable served by the endpoint
- `packages/start/src/services.ts` — `RequestServices`, `Cookies`, `ResponseHeaders`, `requestServices`
- `packages/start/src/start.ts:55-110` — the Request Scope and the page's runtime
- `packages/start/src/__tests__/start.test.ts` — how cookies and `Set-Cookie` are asserted
- `packages/start/src/__tests__/service.test.ts`, `service.test-d.ts` — the Server Service test shapes

**Optional** (reference as needed):
- `apps/realworld/server/app.ts:60-120` — the hand-written equivalent being replaced

## Acceptance
- [ ] Test through `start(...).fetch`: a wire call to an implementation method sets a cookie (`Set-Cookie` on the response) and another reads the request's cookie.
- [ ] Test: a loader doing `yield* Tag` during a page render calls an implementation that sets a cookie, and the page response carries it; the `ResponseHeaders` question is answered by a test and recorded in ADR 0052.
- [ ] Type test: an implementation method needing a service outside `Request | Cookies | ResponseHeaders` is a type error at `implement`; a narrow contract error still type-checks; `Layer<Tag>` is the result.
- [ ] Test: a cookie value outside the grammar fails as `InvalidCookie` does for a Server Function.
- [ ] The client chunk still holds no server module (the existing `./client` import list is unchanged).
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=@sleekstack/testing` passes.

## Done summary
Added `implement(Tag, methods)` to `@sleekstack/start` (new `packages/start/src/implement.ts`, server entry only). It builds `Layer<Tag>`, and its methods may require `Request | Cookies | ResponseHeaders`; any other service is a type error at the call. Tests pin both paths. On the wire, a method's cookie write becomes `Set-Cookie` and a method reads the request's cookie. In process, a page loader doing `yield* Session` sets a cookie and a `ResponseHeaders` header, and both reach the page response; ADR 0052 records that answer. A bad cookie value gives the same response as a Server Function that declares `InvalidCookie`. `callService` accepts an `implement` Layer and provides the request services per call. The `./client` imports are unchanged.

Tests: packages/start/src/__tests__/implement.test.ts, implement.test-d.ts; packages/testing/src/__tests__/serverFn.test.ts ("an implement Layer gets the request services per call").
baseline: not captured pre-edit; post-change gate green.

Tier: session (jev-unavailable(no_key)); project routing block pins implementer opus at medium

stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: dc3e24a699c19af6e6ffb2216d120294c74df672
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/start... --filter=@sleekstack/testing
- PRs: