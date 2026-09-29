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
TBD

## Evidence
- Commits:
- Tests:
- PRs:

