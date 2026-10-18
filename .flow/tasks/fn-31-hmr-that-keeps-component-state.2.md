---
satisfies: [R2]
---
# fn-31-hmr-that-keeps-component-state.2 Hot update remounts an instance on hook-count change

## Description
In hot-update mode, a slot-count change remounts that instance instead of failing the run. Same files as task 1, hence the dependency.

**Size:** S
**Files:** packages/ui/src/reactive.ts, packages/ui/src/dom.ts, packages/ui/src/__tests__/hmr.test.ts
**Touches:** [packages/ui/src/reactive.ts, packages/ui/src/dom.ts, packages/ui/src/__tests__/hmr.test.ts]

### Approach
- The `SlotMismatch` check at reactive.ts ~1184 and `takeSlot` (~164) stay as is outside hot mode; in hot mode, mismatch discards that instance's slots and re-runs it fresh (remount), instead of `Effect.fail`.
- Keyed lists: other keyed siblings keep their slots when one instance remounts.
- Behavior pin: existing `SlotMismatch` tests in reactive-dom.test.ts / slot-hook.test.ts pass unchanged.

### Investigation targets
**Required**:
- packages/ui/src/reactive.ts:139-175, 1180-1200
- packages/ui/src/__tests__/slot-hook.test.ts

## Acceptance
- [ ] Hook added/removed in an updated component remounts that instance, no `SlotMismatch` reaches `onError`
- [ ] Keyed siblings keep state during the remount
- [ ] Outside hot update, `SlotMismatch` still fails into `onError` (existing tests unchanged)

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
