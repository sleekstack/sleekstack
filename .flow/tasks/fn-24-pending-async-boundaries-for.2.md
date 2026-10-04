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
Pending now routes a failed content fork through the instance's handler path: the cause is stored in the slot and raised on the slot-set re-run, so the nearest Boundary renders its fallback, or onError gets it with the fallback (or previous content on a re-run) left on screen. A newer fork interrupts and closes an unfinished older one (latest wins), and disposing the Pending retires the fork in the same tick so a late completion writes nothing. dom.ts and reactive.ts needed no change: kill already closes the content scope via disposeSlots, and keep-previous/commit-time release already held from fn-24.1.

Tests (packages/ui/src/__tests__/pending.test.ts): R2 keep-previous with query observer count, R1 Boundary / onError / failed re-run, R3 unmount and supersede (interrupt, scope closed, observers 0, stale gate ignored), nested innermost-wins, nested instance awaiting in its own re-run without the fallback, keyed key-change. The four new-behavior tests were confirmed red against the fn-24.1 pending.ts.

Limit: with a matching Boundary, a failed re-run shows the Boundary fallback (error path unchanged); only the no-Boundary case keeps the old content.
Follow-up kept: one scope closer per fork accumulates in the content slots until dispose.

baseline: green via handoff (verified at f44c401 by fn-24.1)
stage: impl-review - skipped(config: REVIEW_MODE=none)
Tier: implementer: opus at medium (project routing block)
## Evidence
- Commits: 3bf5b554539652867cc016f7c2a51d60121ea6ea
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=@sleekstack/analyze --filter=ui-demo
- PRs: