---
satisfies: [R1, R2, R3, R4, R7, R8]
---
# fn-48-code-splitting-with-lazy.1 lazy and LazyLoadError

## Description
lazy and LazyLoadError. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/ui/src/lazy.ts (new), packages/ui/src/index.ts, tests in packages/ui/src/__tests__/lazy.test.ts
**Touches:** [packages/ui/src/lazy.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/lazy.test.ts]

### Approach
- Memoize the `load()` promise per loader, evicting on rejection; call the loaded default via `jsx`; `Effect.tryPromise` into an exported tagged `LazyLoadError` (Boundary catches by `_tag`, so a defect would escape).
- Probe results (fn-38.D1): string render awaits it, mount shows the fallback then content, hydrateMount adopts the server node; keep tests for all three.
- Island memory: after an async chunk import, re-check liveness before using the result.

## Acceptance
- [ ] Fallback then loaded content; string output contains it; hydration adopts the node (R1, R2)
- [ ] No second import on re-run (R3)
- [ ] Rejected import is a LazyLoadError at the nearest Boundary, else onError; retried next time (R4, R7, R8)
- [ ] Missing default export fails the same way (R8)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
