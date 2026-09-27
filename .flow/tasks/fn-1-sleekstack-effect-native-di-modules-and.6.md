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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
