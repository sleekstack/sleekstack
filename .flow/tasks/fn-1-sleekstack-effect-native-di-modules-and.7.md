---
satisfies: [R9]
---
# fn-1-sleekstack-effect-native-di-modules-and.7 React adapter: LayerProvider + useService (component scope, status cache, errors)

## Description
Provider and hook rewritten on the core scope runtime with the probe's strategy (R9).

**Size:** M
**Files:** `packages/react/src/LayerProvider.tsx`, `packages/react/src/useService.ts`, `packages/react/src/context.ts`, `packages/react/src/index.tsx`, `packages/react/src/__tests__/useService.test.tsx`, `packages/react/src/__tests__/LayerProvider.test.tsx`
**Touches:** [packages/react/src/**]

## Approach
- Replace prototype files, do not patch.
- Cache entry is a discriminated union (pending / resolved / rejected); check order resolved -> rejected -> pending; stable promise identity per entry (required by Suspense/`use`).
- A top-level provider (no parent provider) creates and owns an app scope for app-lifetime entries plus its component scope; lifecycle strategy from .6.
- Unmount finalizer failures go to the provider's `onFinalizerError` prop (default `console.error`).
- Missing service error: descriptive, names Tag and suggests providing it.
- Dev warning when `provide` identity changes after mount.

## Investigation targets
**Required:**
- `packages/react/src/useService.ts:67-104` — prototype bug (`!== undefined`)
- `packages/react/src/__tests__/useService.test.tsx` — existing cases to keep
- https://react.dev/reference/react/use

## Acceptance
- [ ] All tests use renderStrict
- [ ] Suspends once then sync; undefined-valued service works
- [ ] Acquisition failure reaches ErrorBoundary
- [ ] Missing service error descriptive
- [ ] Finalizers run on unmount exactly once
- [ ] Top-level provider resolves app-lifetime entries without any outer runtime
- [ ] A failing finalizer on unmount reaches `onFinalizerError`

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
