---
satisfies: [R1]
---
# fn-54-start-server-core-for-sleekstackui.1 router: track page and loader requirements as a type parameter

## Description
Thread a requirement type `R` through `Page`, `Router`, `router()`, `startRouter` and `handle`, so the client layer must provide what the pages and their loaders need. This is the prerequisite found by the D2 spike: today `Page.render` is `Effect<Node, any, any>` and the entries take `Layer<any, any, never>`, which erases the check.

**Size:** M
**Files:** packages/router/src/resolve.ts, history.ts, server.ts, loader.ts, index.ts; new packages/router/src/__tests__/requirements.test-d.ts; adjust apps/showcase/src/pages/router.tsx if inference needs it
**Touches:** [packages/router/src/**, apps/showcase/src/pages/router.tsx]

### Approach
- Make `Router` and `Page` generic over the requirement `R` with a default that keeps today's apps compiling (pages with no requirements stay unchanged); `router()` infers `R` from the pages' `render` and `loaders`.
- `startRouter` and `handle` take `layer: Layer<R, ...>` (optional only when `R` is `never`), via a conditional options type.
- Keep `Route` / `Loaders` / `Transfer` services out of `R` (the router provides them), as `useLoader` already does.
- Equivalence pin: the existing router and showcase router tests must pass unchanged.

### Investigation targets
**Required**:
- `packages/router/src/resolve.ts` (Page, Router, view, resolve)
- `packages/router/src/history.ts` (StartOptions, startRouter, mount calls)
- `packages/router/src/server.ts` (HandleOptions, handle)
- `packages/router/src/loader.ts` (Loader type already carries R; useLoader)
- `packages/router/src/__tests__/params.test-d.ts` (type-test style)
**Optional**:
- `docs/adr/0036-*.md`
- `apps/showcase/test/router.test.ts`

## Acceptance
- [ ] A type test shows a plain-Effect page needing a service absent from the `startRouter` / `handle` layer fails to compile, and compiles when the layer provides it
- [ ] A type test shows a loader reading a service absent from the client layer is rejected
- [ ] JSX pages are out of scope here (ui types JSX as requirement-free; covered by task .7 and R12); a code comment or test note says so
- [ ] Router apps with requirement-free pages compile unchanged; all existing router and showcase tests pass
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=showcase` is green
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
