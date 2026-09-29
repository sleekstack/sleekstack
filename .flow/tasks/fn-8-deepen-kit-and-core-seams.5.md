---
satisfies: [R5]
---
# fn-8-deepen-kit-and-core-seams.5 Extract the LayerProvider scope lifecycle module

## Description
Extract the LayerProvider scope lifecycle (park/adopt/GC timer/deferred close/atom store wiring/owner identity) from packages/react/src/LayerProvider.tsx into an internal module (e.g. packages/react/src/managedScope.ts) with its own tests; LayerProvider becomes a thin component. Add a test pinning the documented time-sliced sibling-sharing limit.

Touches: packages/react/src/LayerProvider.tsx, packages/react/src/managedScope.ts, packages/react/src/__tests__/managedScope.test.ts, packages/react/src/__tests__/**

## Acceptance
- [ ] LayerProvider.tsx contains no park/adopt/GC logic; the lifecycle module has direct tests for adopt, park GC and close ordering.
- [ ] All react, kit and showcase tests pass unchanged (pnpm test --force); the sibling limit is pinned by a test.


## Done summary
Moved LayerProvider's scope lifecycle (create, park/adopt, ADOPT_MS GC, deferred close with StrictMode cancel, close ordering) into packages/react/src/managedScope.ts, exposed as acquire/mount; LayerProvider is now a thin component. Direct tests in __tests__/managedScope.test.ts cover adopt (props, owner, stale shape), park GC, close ordering, deferred close, and pin the time-sliced sibling-sharing limit.

Drift: the pending-close token moved from a per-instance ref onto Owned (same behavior: one Owned per mounted instance).

stage: impl-review - ran [codex fan-out NEEDS_WORK (deferred close left in component) -> fixed -> SHIP]
## Evidence
- Commits: 3a69257574e34030e471d5c000f2a43c67fa20e1, c9b09945436bf9a8a54d70b0f4568cc62214e77d
- Tests: pnpm typecheck && pnpm test --force, pnpm --filter ./apps/docs build && pnpm --filter ./apps/docs test, baseline: none (not run pre-edit)
- PRs: