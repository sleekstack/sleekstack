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
Under a hot update, a hook-count change remounts only the affected instance and no longer fails into `onError`. Its slots are disposed and it re-runs fresh, keeping its handler stand-ins. Keyed siblings whose hook count did not change keep their state. The instance's last successful function is stored on `Slots.ran`, so the check also works when a parent re-run reaches the child first. If a remount throws, the revert to the previous function runs that function on fresh slots. Outside a hot update (the function has not changed since the last commit), `SlotMismatch` still fails into `onError`. The existing reactive-dom/slot-hook tests pass unchanged.

Tests, all in packages/ui/src/__tests__/hmr.test.ts:
- "an update that changes an instance hook count remounts that instance; keyed siblings keep their state" covers AC1 and AC2, for both a hook added and a hook removed.
- "remounts when a parent re-run reaches the updated child first" covers the parent re-run path.
- "a remount whose run throws reverts to the previous function with fresh slots" covers a remount that throws.
- "outside a hot update a hook-count change still fails into onError" covers AC3.

Each new test failed before its fix, and the AC3 test was mutation-checked. dom.ts needed no change.

Quick command: only the `@sleekstack/ui...` part ran, because `@sleekstack/ui-vite` does not exist yet (fn-29).

stage: impl-review - ran (codex fan-out NEEDS_WORK with 2 merged findings, both fixed in 759f4fa; re-review SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: 5c43e889c1c9ba8c290243c73a1fa77bcabd9092, 759f4fab79330b96dff287ec4d63e22299472e07
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui...
- PRs: