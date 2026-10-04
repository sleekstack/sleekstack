---
satisfies: [R4]
---
# fn-23-reconciling-dom-renderer-keys-host.6 ui dom: React guests keep their root across parent re-runs

Touches: packages/ui/src/dom.ts, packages/ui/src/__tests__/reactive-dom.test.ts, packages/ui/README.md

## Description
Matched guests keep their React root and host element; only props are re-rendered (spec Architecture: Guests; Edge Cases: guests created in the plan phase).

**Size:** M
**Files:** `packages/ui/src/dom.ts`, `packages/ui/src/__tests__/reactive-dom.test.ts`, `packages/ui/README.md`
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/__tests__/reactive-dom.test.ts, packages/ui/README.md]

### Approach
- A `Guest` node matches when its React component function is the same (and key, if any). Apply: `root.render(createElement(GuestBoundary, ..., createElement(component, props)))` inside `flushSync` (the first render already does this), from the renderer's microtask only. New guests are created in the plan phase in a detached host and unmounted if the plan is dropped. Unmount only on removal, component change or key change.
- `GuestBoundary` stays sticky (renders nothing after a throw until unmount); do not reset it on new props.
- Remove the README caveat 'guests inside the re-run subtree are remounted and lose their React state' and the 'keep stateful guests outside' advice (full README rewrite is the docs task; just fix this sentence here so no stale claim ships).

### Investigation targets
**Required**:
- `packages/ui/src/dom.ts:18-29,137-157` (`GuestBoundary`, guest `build`)
- `packages/ui/src/__tests__/reactive-dom.test.ts:94` ('a guest given the setter')
- `apps/ui-demo/src/guests.tsx` (`Votes`: a stateful React guest for the test fixture shape)
- memory: island async chunk load must check an activation token; generation-token re-mount

### Acceptance
- [ ] A guest with React `useState` keeps its state when its parent host component re-runs; new props reach the existing root.
- [ ] A guest unmounts and loses state when removed, when its component changes, or when its key changes.
- [ ] A throwing guest still renders nothing and reports through `onError`; a dropped plan leaks no guest root or React effect (assert effect cleanup).

## Acceptance
- [ ] TBD

## Done summary
A matched guest now keeps its React root and host element. It matches when the component and key are the same, or by position in the unkeyed pool. On commit only its props re-render, through `flushSync` (`renderGuest` in dom.ts). It unmounts when removed or when its component or key changes. GuestBoundary stays sticky. The README remount caveat is gone. New test: "a matched guest keeps its React state..."; the existing plan-failure test asserts guest effect cleanup.

stage: impl-review - skipped(config: REVIEW_MODE=none)
Tier: session (jev-unavailable(no_key)); routing block pins implementer opus at medium
## Evidence
- Commits: a0fb9c8403a2f01865f9722ec7f56e8e98532adb
- Tests: pnpm --filter @sleekstack/ui test, pnpm --filter @sleekstack/ui typecheck, pnpm --filter bench bench:json && pnpm --filter bench compare
- PRs: