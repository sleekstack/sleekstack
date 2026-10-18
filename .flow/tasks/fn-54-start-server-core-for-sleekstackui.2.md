---
satisfies: [R2, R7, R8]
---
# fn-54-start-server-core-for-sleekstackui.2 start: package, fetch entry, request services, route handlers, middleware

## Description
Create `@sleekstack/start` with the `start({ router, layer, functions, handlers, middleware })` entry returning `fetch`. This task covers dispatch, the Request Scope and request services, route handlers and middleware; server functions plug into the dispatch in the next task (accept `functions` and ignore it until then, with a named placeholder that task 3 replaces).

**Size:** M
**Files:** new packages/start/package.json, tsconfig*.json, src/index.ts, src/start.ts, src/services.ts, src/handler.ts, src/middleware.ts, src/__tests__/*
**Touches:** [packages/start/**, pnpm-workspace.yaml, pnpm-lock.yaml]

### Approach
- Package layout copies `packages/router` (type module, `sideEffects: false`, peer deps on effect, ui, core, router; runtime as a dependency).
- Run every stage through `runEffect` from `@sleekstack/runtime` with a request Layer holding `Request`, `Cookies`, `ResponseHeaders`; follow how `kit/next` builds its request layer.
- Page stage delegates to the router's `handle`; unmatched path gets its not-found page with 404.
- `Cookies` set/delete accumulate into `Set-Cookie` on the final response; reject cookie names and values that break the cookie grammar with a typed error.
- Handler: a map of HTTP method to an Effect over the request returning a `Response`; unsupported method answers 405 with `Allow`.
- Middleware: ordered list; each continues or returns a `Response`, which skips the rest.
- Defects go to the runtime error sink and answer 500 without internals when `NODE_ENV` is production.
- Add the package to the workspace; check `git diff pnpm-lock.yaml` for stray `apps/sleek-codes` entries before committing.

### Investigation targets
**Required**:
- `packages/router/package.json`, `packages/router/tsconfig*.json` (package shape)
- `packages/kit/src/next/action.ts` and `runtime.ts` (request Layer, `runEffect` use)
- `packages/runtime/src/runtime.ts` (`runEffect`, `RunEffectOptions`, error sink)
- `packages/router/src/server.ts` (`handle`)
**Optional**:
- `docs/adr/0013-framework-agnostic-runtime-package.md`
- `packages/testing/src/mockLayer.ts`

## Acceptance
- [ ] A request flows middleware, then handler or page; a middleware `Response` short-circuits; order is tested
- [ ] Unmatched path is the router's not-found page with 404; unsupported handler method is 405 with `Allow`
- [ ] A throwing middleware, handler or page reaches the runtime error sink and answers 500 with no stack or message in production
- [ ] `Cookies` sets and deletes produce `Set-Cookie`; an invalid cookie name or value is a typed error; services are replaceable by a test layer
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/start...` is green

## Done summary
New package `@sleekstack/start`. `start({ router, layer, handlers, middleware, functions, onError })` configures the runtime over `layer` and returns `fetch`. Each request runs in one `runEffect` Request Scope: middleware in order (a `Response` short-circuits), then the server-function stage, then the route handler for the exact pathname (405 with `Allow` listing only the defined methods), then the router's `handle` (an unmatched path gets the not-found page with 404). The server-function stage is the `serverFunctions` placeholder in `start.ts`, which task 3 replaces. The request services are `Request`, `Cookies` and `ResponseHeaders` Tags. A cookie name, value, path, domain, maxAge or expires outside the grammar fails with `InvalidCookie`. `Set-Cookie` lines are keyed by name, path and domain and are added to every response, a 500 included. A defect or a typed failure in any stage reaches the error sink and answers an empty 500. `Redirect` / `NotFound` from middleware or a handler answer 302 / an empty 404. Task 3 owns R9's full wire behavior. Type test `layer.test-d.ts`: `layer` is required and checked when pages, handlers or middleware need services beyond the router's own and the request services. Tests in `start.test.ts` cover each acceptance criterion and error case.

Deviations and follow-ups:
- Peer deps are effect, ui and router. core is left out because start does not use it.
- The page stage passes the Request Scope's context to `handle` as its layer, so services resolve in the scope. `handle` still runs its Effects on its own runtime, so runtime FiberRefs (devtools trace) do not reach page renders. Fixing that needs an Effect-returning router entry, outside these Touches. The review raised it, and the coordinator dropped it because the spec says the page stage delegates to `handle`.
- `RouterProvided` still includes `Route`; this task did not touch it (outside Touches). start duplicates the router-provided set in its `Needs` type, because router does not export `Requirements`.
- Spec Quick command: showcase#test fails in `test/fixtures.test.ts` "the demo app itself is clean" (expects 4 analyzer trees, gets 5). This branch changed no showcase or analyzer file. The failure comes from task .7's new startRouter/handle roots (inherited, not caused by this task).

baseline: green (router; start did not exist)
stage: impl-review - ran (codex fan-out round 1 NEEDS_WORK, 5 findings fixed in d76fc12; re-review --base master SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: 564f26967811b08d6438e05a7408ee273d38077a, d76fc12b543f2676ee5684da0bcbfa0eed423981
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/start..., pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/start... --filter=@sleekstack/testing --filter=showcase (red: showcase fixtures.test.ts inherited from task .7)
- PRs: