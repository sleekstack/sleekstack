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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
