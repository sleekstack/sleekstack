---
satisfies: [R4, R6]
---
# fn-9-static-build-time-dependency-graph.7 Remove snapshot and runtime graph validation; introduce ResolutionPlan

## Description
Add the internal `ResolutionPlan` (`buildPlan(entries)`, no validation) and migrate `packages/next` runtime, `packages/react` managedScope and kit's module code to it in one change; delete `snapshot`, the public `Graph` types, `checkLifetimes` and the build-time missing / private / cycle / ambiguity checks. Runtime `provide` and child boundaries keep their throwing paths for `DuplicateTag`, `DependencyCycle`, `AmbiguousProvider`.

**Size:** M
**Files:** packages/core/src/{graph.ts,lifetime.ts,scope.ts,index.ts,errors.ts}, packages/next/src/runtime.ts, packages/react/src/managedScope.ts, packages/kit/src/module.ts, ported tests
**Touches:** [packages/core/**, packages/next/**, packages/react/**, packages/kit/src/module.ts, packages/kit/src/index.ts]

### Approach
- Split explicitly: `buildPlan` (root, vetted by the analyzer: traversal, shadowing winner selection, ordering, no throwing for missing / private / captive / cycle / ambiguity) versus the validating dynamic-boundary path (per-call `provide`, child scopes, `LayerProvider`) that keeps `resolveEntries` / `toposort` throws; share the traversal code.
- Equivalence harness: record the current runtime behaviors (scope build order, shadowing, private-Tag hiding, error codes) as tests before deleting, and run them after.
- Runtime `MissingDependency` / `PrivateDependency` on resolve stays.

### Investigation targets
**Required**:
- `packages/core/src/graph.ts:264-342` — buildGraph, snapshot
- `packages/core/src/scope.ts:148-263` — child scopes and makeAppScope
- `packages/next/src/runtime.ts:96`, `packages/react/src/managedScope.ts:116`, `packages/kit/src/module.ts:148`

### Acceptance
- [ ] Root plan performs none of the removed checks; dynamic-boundary path still throws DuplicateTag, AmbiguousProvider, DependencyCycle (tests for both)
- [ ] No public export of `snapshot` / `Graph` / `GraphSnapshot`; consumers compile
- [ ] Equivalence tests and all remaining suites pass
- [ ] Runtime provide still rejects DuplicateTag, DependencyCycle, AmbiguousProvider

## Acceptance
- [ ] TBD

## Done summary
Core's internal `buildPlan(entries)` (graph.ts, not exported) resolves the root with no validation: ties go to the first provider, and cycles are ordered leniently so the lazy build fails with DependencyCycle. `makeAppScope` now takes entries and builds the plan itself, so next, react and the kit tests pass `provide` straight in. Child boundaries still throw AmbiguousProvider and DependencyCycle through strict `resolveEntries`/`toposort`, and kit `validateProvide` still throws DuplicateTag. `snapshot`, Graph/GraphNode/GraphSnapshot/Shadowing and `checkLifetimes` are gone, along with the build-time checks. Equivalence tests are in packages/core/src/__tests__/plan.test.ts, and ported tests were removed per the port list.

Drift: kit module.ts no longer needs any plan now that snapshot is gone, and the plan is reached through makeAppScope rather than imported by adapters. The showcase-kit DuplicateTag case calls configureRuntime, which throws before configuring. To keep that call from becoming a second analyzer root, showcase-kit `check`/`report` (and the cli/showcase-kit tests) now pass `--entry src/server/runtime.server.ts`. Root makeAppScope still has the scope's resolve-time MissingDependency/PrivateDependency backstop, so an app->request captive now surfaces as MissingDependency.

stage: impl-review - skipped(policy: host-deferred - conductor owns the gate)

Review: independent host review SHIP (no P0/P1). Follow-ups (not blocking): --entry is a silent allowlist for extra configureRuntime roots; no test that DuplicateTag demo leaves existing runtime intact.
## Evidence
- Commits: 4eca13c02ab1aad1efb783aa655e0cecf0d5eb11
- Tests: pnpm -r test, pnpm typecheck, pnpm --filter showcase-kit check, pnpm --filter showcase-kit build
- PRs: