---
satisfies: [R1, R2, R3]
---
# fn-24-pending-async-boundaries-for.2 ui: Pending keeps previous content, error path, supersede/unmount interrupt

## Description
Lifecycle on top of task 1: re-runs keep the previous resolved subtree live until the replacement commits, forked-fiber failures reach the nearest Boundary or onError, and every exit path interrupts the content fiber and closes scopes.

**Size:** M
**Files:** packages/ui/src/pending.ts, packages/ui/src/dom.ts, packages/ui/src/reactive.ts, packages/ui/src/__tests__/pending.test.tsx
**Touches:** [packages/ui/src/pending.ts, packages/ui/src/dom.ts, packages/ui/src/reactive.ts, packages/ui/src/__tests__/pending*]

### Approach
- Keep-previous: only the first run shows `fallback`; a later re-run leaves the old content on screen and closes its content scope when the replacement commits (dom.ts already closes the previous run scope at commit, l.507).
- Forked failure: store the cause in the slot handle and re-raise it on the slot-set re-run so it flows through `handled(run)` with the captured `Handlers`; after a fallback is committed and `mount` has resolved, a failure with no matching Boundary goes to `onError` and leaves the fallback showing; a failed re-run keeps old content and reports.
- `kill`/unmount/supersede must interrupt the content fiber (not only `inst.fiber`, the rerun fiber) before the slot atom is released.
- Nested Pending: innermost wins and the outer content does not wait on an inner boundary; a nested instance re-running on its own with new suspending content awaits in its own rerun and never shows fallback (document in the test name).
- Keyed Pending: a key change is a new instance and a fresh fiber.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/dom.ts` kill, rerun runner (~l.455-470), applyRun (~l.480-507)
- `packages/ui/src/reactive.ts` handled/withHandlers/scopedRun/asFallback
- `packages/ui/src/__tests__/query.test.ts` retain-count assertions

## Acceptance
- [ ] R2 test: a re-run never shows fallback and the old subtree's observer retain count stays above zero until the new content commits, then releases.
- [ ] R1 error test: content failure renders the nearest Boundary fallback; with none it reports to `onError` and leaves `fallback` showing; a failed re-run keeps the old content and reports.
- [ ] R3 tests: unmount while pending and supersede while pending both interrupt the fiber, close scopes, leave no listener/subscription/observer (retain count 0); latest-wins holds.
- [ ] Nested Pending, keyed Pending and key-change tests pass.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
