---
satisfies: [R5]
---
# fn-29-sleekstack-vite-plugin.3 Stable component id transform wired into fnId

## Description
Transform assigns each component function a stable id from file path + export name; `fnId` in `packages/ui/src/reactive.ts` consumes it and keeps the counter fallback when the plugin is absent. Enables fn-31.

**Size:** M
**Files:** packages/ui-vite/src/ids.ts, packages/ui/src/reactive.ts, tests in both packages
**Touches:** [packages/ui-vite/src/**, packages/ui/src/reactive.ts, packages/ui/src/__tests__/**]

### Approach
- Deterministic, survives re-export; duplicate id across two files fails the build.
- Modify `fnId` at `packages/ui/src/reactive.ts:206` minimally; check `fnIds` WeakMap use at :204.
- Run the ui verify command (dependents included).

### Acceptance
- [ ] Ids stable across module re-evaluation in a test (R5)
- [ ] Without plugin ids still work (R5)
- [ ] Duplicate id fails build (R5)

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
