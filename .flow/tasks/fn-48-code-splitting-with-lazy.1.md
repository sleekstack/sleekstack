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
Added `lazy(load)` and the tagged `LazyLoadError` to @sleekstack/ui. The import is memoized per loader and evicted when it rejects. A rejected import or a missing default export becomes a `LazyLoadError`. The default export is typed as `ComponentResult`. Tests cover the mount fallback followed by content, string render, hydration node adoption, no re-import, Boundary/onError delivery and retry, plus a type test.

stage: impl-review - ran (codex fan-out NEEDS_WORK on the loose default-export type, fixed; re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: ab6312efbf9436eef559e7025e9aaa6a1f43f616, f58bd0bbb33545214ccf6e26da25d28c748d171d
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui...
- PRs: