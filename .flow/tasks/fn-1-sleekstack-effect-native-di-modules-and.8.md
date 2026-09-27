---
satisfies: [R9, R11]
---
# fn-1-sleekstack-effect-native-di-modules-and.8 React adapter: nested providers over async parents, inner-before-outer finalization, nested shadowing

## Description
Nesting semantics (R9) on top of the provider.

**Size:** M
**Files:** `packages/react/src/LayerProvider.tsx`, `packages/react/src/__tests__/nesting.test.tsx`, `apps/playground/src/App.tsx`, `apps/playground/src/services.ts`
**Touches:** [packages/react/src/**, apps/playground/**]

## Approach
- Child provider builds a child scope from the parent scope (core .4), suspending while the parent is still acquiring; no synchronous parent-context extraction.
- Parent close waits for child closes (inner before outer).
- Nested `provide` shadows parent entries for the subtree only.
- Nested provider entries are built in the child scope via core's child-boundary API (lifetime coerced to component).
- Update playground to a nested async example; split Tags into a Tag-only module separate from service definitions, with one server-only implementation module carrying a marker string.
- Bundle check: build the playground and assert the marker string is absent from the client output (R11).

## Investigation targets
**Required:**
- `packages/react/src/LayerProvider.tsx:145-184` — prototype runSync limitation (do not reuse)
- `packages/react/src/__tests__/nesting.test.tsx` — cases to make pass

## Acceptance
- [ ] Nested provider over async parent resolves (StrictMode)
- [ ] Inner finalizers run before outer on unmount
- [ ] Nested shadowing limited to subtree
- [ ] Playground runs
- [ ] Playground build output does not contain the server-only marker; check runs in `pnpm test`

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
