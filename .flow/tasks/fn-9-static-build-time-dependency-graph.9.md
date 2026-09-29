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
Added `layer(Tag, function* () {...})` (separate overload keyed on the 3rd arg; runtime detection via effect/Utils isGeneratorFunction, a GeneratorFunction-constructor check). Core `lazy.ts` holds the per-scope state machine (building = shared Deferred, built, failure clears marker; key on resolving chain -> DependencyCycle); `scope.ts` open() now calls `buildAll`, which builds each node into its own Scope attached to the parent only on success (finalizers once, reverse build order) and provides an internal `Resolver` so generator yields build local providers on demand, else read the parent, else MissingDependency/PrivateDependency. Analyzer reads a generator layer's yields (same `yieldsOf` as actions: helpers, Effect R, fail closed) as its requires, feeding missing/captive/cycle with file:line (fixture `generator-layers`).

Review fix: the analyzer detects generator impls by type (call-signature return type Generator). It reads both branches of a conditional, fails closed with Unresolvable on unreadable bodies (factory-returned, .d.ts), and reads opts from arg 3, so imported generators keep their lifetime. Node scope build -> attach now runs under uninterruptibleMask.

stage: impl-review - skipped(policy: host-deferred - conductor owns the gate)

Review: independent host review, 3 passes -> SHIP at a708164. Union-return impl is rejected by kit's overloads (TS2769), so no analyzer gap.
## Evidence
- Commits: 66fa0e25989e237c07be541689199ac30d4d458d, 871411328bdb9c6922ac1ada02834cbf6c9d5916, a708164a7192252aa996c8a64b54aaa208796db2
- Tests: pnpm --filter @sleekstack/kit test, pnpm --filter @sleekstack/core test, pnpm --filter @sleekstack/analyze test, pnpm --filter @sleekstack/next test, pnpm --filter showcase-kit test, pnpm --filter showcase-kit check, pnpm typecheck
- PRs: