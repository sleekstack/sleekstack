---
satisfies: [R12]
---
# fn-9-static-build-time-dependency-graph.9 Generator layer factories: lazy runtime resolution and analyzer edges

## Description
`layer(Tag, function* () {...})` takes a generator factory. Runtime: requirements come from the `yield*`s, resolved lazily and memoized per scope, keeping lifetime rules and reverse-order finalizers. Analyzer: layer requirements come from the yielded Tag types (same inference as action bodies) and feed the missing, captive and cycle checks.

**Size:** M
**Files:** packages/kit/src/layer.ts, packages/core/src/service.ts, packages/core/src/scope.ts, packages/analyze/src/{extract.ts,actions.ts}, tests and fixtures
**Touches:** [packages/kit/src/layer.ts, packages/core/src/service.ts, packages/core/src/scope.ts, packages/analyze/**]

### Approach
- State machine in its own module: unbuilt / building (shared in-flight promise) / built / failed; re-entrancy via the resolving chain -> `DependencyCycle`; failed builds are not memoized and clear their marker; finalizers register once on success. Do not grow `scope.ts`'s `open` beyond a call into it.
- Detect a generator factory at runtime (`GeneratorFunction` constructor name); the array overload stays first-class and needs no detection.
- Equivalence harness: existing layer tests (ordering, lifetimes, cleanup order, cycle and captive errors) must pass unchanged for the array form.
- Overload caution: keep the two forms as separate overloads keyed on the deps-array argument, not on the factory's arity (a zero-param factory is assignable to any factory type).

### Investigation targets
**Required**:
- `packages/kit/src/layer.ts:109-142` — layer(), LayerInfo
- `packages/core/src/service.ts:26-118` — ServiceDefinition, requires, CaptiveViolations
- `packages/core/src/scope.ts:148-263` — lazy build, finalizers

### Acceptance
- [ ] Concurrent resolves of one provider build it once and register one finalizer; a failed build retries on the next resolve
- [ ] Generator layer resolves its yielded Tags lazily; finalizers run in reverse build order
- [ ] Unprovided yield fails with MissingDependency; re-entrant build fails with DependencyCycle
- [ ] Analyzer reports edges, missing, captive and cycle for generator layers with file:line

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

