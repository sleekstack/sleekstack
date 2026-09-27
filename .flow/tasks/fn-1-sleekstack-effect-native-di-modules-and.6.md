---
satisfies: [R9]
---
# fn-1-sleekstack-effect-native-di-modules-and.6 React lifecycle probe: StrictMode-safe provider strategy (deferred dispose vs rebuild on remount)

## Description
Isolated probe before any provider code (R9 StrictMode). Pick the lifecycle strategy with evidence.

**Size:** S
**Files:** `packages/react/src/__tests__/lifecycle-probe.test.tsx`
**Touches:** [packages/react/src/__tests__/lifecycle-probe.test.tsx, .flow/specs/fn-1-sleekstack-effect-native-di-modules-and.md]

## Approach
- Minimal throwaway provider over a plain ManagedRuntime; implement both strategies in the test file: (a) dispose deferred to a microtask/timeout and cancelled on remount, (b) rebuild runtime on remount + force re-render.
- Assert under `renderStrict`: context never exposes a disposed runtime; finalizers run exactly once on real unmount; no double acquisition visible after settle.
- Record chosen strategy + reason in spec Decision Context.

## Investigation targets
**Required:**
- `packages/react/src/LayerProvider.tsx:173-244` — failed prior approach (do not reuse)
- https://github.com/tim-smart/effect-atom — registry/runtime lifecycle

## Acceptance
- [ ] Both strategies tested under StrictMode
- [ ] Chosen strategy recorded in spec

## Done summary
Probed the two StrictMode-safe component-scope lifecycle strategies for R9 directly over `@sleekstack/core`'s scope runtime (`AppScope.child('component', entries)`), not a plain `ManagedRuntime` -- the same primitive task .7's real provider is rewritten on, so the result transfers directly. Both strategies were exercised under `renderStrict` with a single ordered acquire/render/release event trace (not set comparisons, per review feedback) proving: no render ever observes an already-released instance, and every acquired instance is released exactly once. Deferred dispose (cleanup defers `dispose()` to a microtask, cancelled if remounted first) produced exactly one acquisition/release across the whole StrictMode double-invoke with zero waste; rebuild-on-remount (dispose immediately + forced re-render rebuilds fresh) was also correct but paid for a spurious acquire+dispose pair and an extra render every StrictMode mount. Chose deferred dispose; recorded in the spec's Decision Context for task .7 to build on. Tests: packages/react/src/__tests__/lifecycle-probe.test.tsx (2 tests). `packages/react/src/LayerProvider.tsx` (the failed prior prototype approach) was read as the required investigation target and not reused.

baseline: green
stage: impl-review - ran (codex: NEEDS_WORK x1 -> SHIP; 1 P2 finding fixed - set-comparison assertions replaced with an ordered acquire/render/release trace, verified by mutation)
## Evidence
- Commits: 809be3822942a8d9d9641032bccea853a66c6a3c, 177c951d9eb44b17ca53d31e73ae9a08d3f5d71e
- Tests: pnpm test, pnpm --filter @sleekstack/react typecheck
- PRs: