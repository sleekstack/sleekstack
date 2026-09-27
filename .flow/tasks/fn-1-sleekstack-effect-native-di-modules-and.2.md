---
satisfies: [R1, R3, R5]
---
# fn-1-sleekstack-effect-native-di-modules-and.2 Spike: hybrid service() definitions + topological wiring + readable missing-dependency error + type-level lifetime cost

## Description
Early proof point (R1). Prove service metadata can drive ordering and readable errors, and measure whether a type-level lifetime check is affordable. Output decides go/no-go for the hybrid approach.

**Size:** M
**Files:** `packages/core/src/service.ts`, `packages/core/src/order.ts`, `packages/core/src/__tests__/spike.test.ts`, `packages/core/src/__tests__/lifetime-types.test-d.ts`, `.flow/specs` decision note via flowctl
**Touches:** [packages/core/src/**, .flow/specs/fn-1-sleekstack-effect-native-di-modules-and.md]

## Approach
- `service(tag, { requires, lifetime }, make)` per spec API Contracts: `make` receives a tuple of resolved services in `requires` order and returns `Effect<Service, E, Scope>`; derive the Layer requirement type from `requires` so types and metadata cannot drift.
- Topological sort over metadata (Kahn); on unsatisfied requirement produce an error naming requiring service + missing Tag; leftover nodes after Kahn -> `DependencyCycle` with the full Tag path.
- Build ~5 services listed in shuffled order and run them through `Layer` composition to prove the ordering yields a working runtime.
- Type spike: encode lifetime in the definition type and check captive dependencies at the type level on a generated ~50-service graph; record `tsc --extendedDiagnostics` check time before/after.
- Record the outcome (go/no-go + measured type cost) in spec Decision Context.

## Investigation targets
**Required:**
- `packages/core/src/index.ts:45-80` — current module() shape and name validation
- `packages/core/src/cycle.ts:22-41` — DFS pattern
**Optional:**
- https://effect.website/docs/requirements-management/layer-memoization/

## Key context
- Calling a layer-producing function twice yields distinct Layers and breaks memoization: the definition must be a value created once.

## Acceptance
- [ ] 5 services in arbitrary order build and resolve correctly
- [ ] Missing dependency error message names requiring service and missing Tag (asserted by test)
- [ ] A requires B, B requires A -> DependencyCycle with path
- [ ] Type tests: `requires` drives the `deps` tuple types and the Layer requirement type; a scoped acquire/release resource is finalized when the scope closes
- [ ] Type-level captive check result and cost recorded; go/no-go written to Decision Context

## Done summary
Spike GO: service(tag, {requires, lifetime}, make) in packages/core/src/service.ts derives the Layer requirement type from requires and passes deps as an ordered tuple; order.ts does Kahn ordering with MissingDependency (names requiring service + missing Tag) and DependencyCycle (Tag path), plus wire() composing a working Layer. Type-level CaptiveViolations on a generated 50-service graph costs ~+0.03s check time (37.6k -> 100.4k instantiations); outcome recorded in spec Decision Context.

baseline: green
stage: impl-review - ran (codex: SHIP first pass)
## Evidence
- Commits: 01a1b58d89548695faa8f75dcf5bc1f49b64636a
- Tests: pnpm typecheck, pnpm test, tsc --noEmit --extendedDiagnostics (type-cost measurement)
- PRs: