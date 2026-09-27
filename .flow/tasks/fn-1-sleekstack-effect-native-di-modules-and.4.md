---
satisfies: [R5, R6]
---
# fn-1-sleekstack-effect-native-di-modules-and.4 Core: lifetime check + scope runtime (fresh memo map per child scope, reverse finalization, failure reporting)

## Description
Lifetime enforcement and the scope runtime every adapter sits on (R5, R6).

**Size:** M
**Files:** `packages/core/src/lifetime.ts`, `packages/core/src/scope.ts`, `packages/core/src/index.ts`, `packages/core/src/__tests__/lifetime.test.ts`, `packages/core/src/__tests__/scope.test.ts`
**Touches:** [packages/core/src/**]

## Approach
- Lifetime matrix check in buildGraph (spec Architecture: Lifetime matrix): request<->component always rejected; error names both services + lifetimes; bare opaque nodes excluded, declared Layers checked. Add type-level check only if spike (.2) said go.
- Child-boundary entries: an API to build extra entries inside a child scope with lifetime coerced to the child's, shadowing parent instances (used by Next per-op provide and nested React providers).
- Scope runtime: app scope builds app-lifetime nodes once (ManagedRuntime-style); child scope (request/component) builds its lifetime's nodes with a fresh `Layer.makeMemoMap` + `buildWithMemoMap`, reading parent services from the parent context, never rebuilding them.
- Close: reverse acquisition order; returns Exit with aggregated Cause of all finalizer failures; remaining finalizers always run; `onFinalizerError` sink option for un-awaited closes (spec Architecture: Cleanup error contract).
- Construction failure after validation closes the scope, finalizing acquired services.

## Investigation targets
**Required:**
- https://effect-ts.github.io/effect/effect/ManagedRuntime.ts.html — build/dispose model
- Effect PR #8385 (MemoMap interruption) — interruption atomicity

## Key context
- Interrupting a memoized build must not leave a hanging entry: add an interruption test.

## Acceptance
- [ ] Captive dependency rejected with both lifetimes named
- [ ] Shared service built once per scope (counter test)
- [ ] Two child scopes of one app scope get distinct child instances, same app instance
- [ ] Finalizers reverse order; with 3 finalizers where the 2nd fails, the 1st still runs and the close Exit contains the failure
- [ ] Construction failure on the 3rd of 4 services finalizes the first 2
- [ ] request->component and component->request dependencies rejected
- [ ] Child-boundary entry shadows the parent instance only inside that child scope
- [ ] Interrupted build does not hang later builds

## Done summary
CaptiveDependency lifetime-matrix check in buildGraph (lifetime.ts, names both services + lifetimes; declared Layers checked, opaque excluded) and scope runtime (scope.ts: makeAppScope, child(lifetime, entries) with fresh memo map per scope, boundary-entry shadowing, reverse finalization with aggregated close Exit, dispose -> onFinalizerError, cleanup on construction failure/interrupt). Tests: lifetime.test.ts, scope.test.ts.

baseline: green
stage: impl-review - ran (codex: NEEDS_WORK -> SHIP, 2 rounds)
memory capture skipped: memory not initialized
## Evidence
- Commits: c922ad15fec06cf94a9f6c03e3c28e896617379a, c1938a1d3d860e50fbcb53fc8b219bcfd8004592
- Tests: pnpm typecheck, pnpm test
- PRs: