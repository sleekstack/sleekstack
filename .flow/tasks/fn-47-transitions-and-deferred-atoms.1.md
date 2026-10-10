---
satisfies: [R1, R2, R3, R9, R10, R11, R12]
---
# fn-47-transitions-and-deferred-atoms.1 startTransition flag and Pending

## Description
startTransition flag and Pending. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/ui/src/dom.ts (watch changed callback, rerun, unwatch), packages/ui/src/pending.ts (emit), packages/ui/src/reactive.ts, core AtomStore batch
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/pending.ts, packages/ui/src/reactive.ts, packages/ui/src/__tests__/transition.test.ts]

### Approach
- Notification is synchronous inside the write but the re-run is a microtask: read the flag in `watch`'s `changed` callback, store it on the instance per epoch, clear in `unwatch` or after the run.
- `Pending.emit` already keeps resolved content; make the flag matter only for a Pending with no content yet. Check ADR 0020 keyed skip is unaffected.

## Acceptance
- [ ] Write in startTransition keeps previous content where a Pending would otherwise show its fallback; ordinary writes show it (R1, R2, R9)
- [ ] Interleaved transition and ordinary writes in one tick behave per write (R10)
- [ ] Failed, superseded, nested and throwing transitions leave no marker (R3, R11)
- [ ] Keyed skip still applies (R12)


## Done summary
Added `startTransition` (ui) on a new core primitive `markedWrites`/`notifyMarked`. When a change was caused only by marked writes, its re-run carries `Transition`. Inside that re-run, a `Pending` with no content yet waits for its content inline, so the previous DOM stays on screen. Captured re-runs and keyed memos ignore the flag, so ADR 0020 skips still apply. Tests are in packages/ui/src/__tests__/transition.test.ts and cover R1-R3 and R9-R12, including writes inside an outer store.batch. The ui README has a startTransition row. The ADR (0034) and full docs belong to task .3.

stage: impl-review - ran (codex: fan-out NEEDS_WORK on outer-batch flag loss, fixed; re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: 1090a06d5f3b0b83512de0de1052443abd3b8559, 36f41bcd3f66ab0b795d3e8d1a8a16987a94399f
- Tests: pnpm turbo run test typecheck --filter=...@sleekstack/core
- PRs: