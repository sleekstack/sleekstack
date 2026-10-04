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
Post-flush failures: the Pending instance's re-run carries its captured handlers, so a failure caught by an enclosing Boundary streams that fallback as the chunk; unhandled, no chunk is sent, the Pending fallback stays and onError gets one report. cancel() now also interrupts in-flight boundary re-run fibers (tracked set) before disposing slots/scope/store; late errors after cancel are dropped (disposed guard) and query observer retain count goes to 0. Most of this behavior already existed from .1; the three new tests in stream.test.ts pin it (they pass with or without the re-run interruption, which covers a re-run racing cancel).

stage: impl-review - skipped(config: no review requested by conductor)
## Evidence
- Commits: 7310099925579008b97be7305e3bb57e3a2c8e59
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo
- PRs: