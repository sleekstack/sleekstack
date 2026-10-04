---
satisfies: [R2, R4]
---
# fn-27-streaming-ssr-for-sleekstackui.3 ui stream: error paths and cancel

## Description
Pre-flush errors reject; post-flush errors stream the nearest Boundary fallback, else keep the Pending fallback and report to `onError`; `cancel()` interrupts fibers and closes the scope.

**Size:** S
**Files:** packages/ui/src/stream.ts, packages/ui/src/component.ts, packages/ui/src/__tests__/stream.test.ts
**Touches:** [packages/ui/src/stream.ts, packages/ui/src/component.ts, packages/ui/src/__tests__/stream*]

### Approach
- Late `onError` after cancel must be dropped; enqueue after close must not throw; interrupt order must leave query observer retain counts at zero (reuse the retain-count seam from fn-24 tests).

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/component.ts` reportRenderError/safeReport (~l.53-60)
- `packages/ui/src/reactive.ts` RenderScope and retain finalizers (~l.28, 111-114)

## Acceptance
- [ ] A boundary failing after flush streams its fallback (R2 error).
- [ ] Cancelling interrupts pending fibers, closes scopes, retain counts 0 (R4).

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
