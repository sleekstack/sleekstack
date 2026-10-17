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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
