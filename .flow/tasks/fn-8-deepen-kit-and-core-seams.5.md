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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
