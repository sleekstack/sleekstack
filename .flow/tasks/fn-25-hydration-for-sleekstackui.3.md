---
satisfies: [R4]
---
# fn-25-hydration-for-sleekstackui.3 ui hydrate: HydrationMismatch policy and recovery

## Description
On a tag/text/guest mismatch report `HydrationMismatch` through `onError` and replace that subtree so the final DOM equals a fresh client render.

**Size:** M
**Files:** packages/ui/src/dom.ts (or hydrate.ts), packages/ui/src/__tests__/hydrate.test.ts
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/hydrate.ts, packages/ui/src/__tests__/hydrate*]

### Approach
- One report per replaced subtree; a defect during the walk falls back to a full client render of the container.
- Cover: non-deterministic render (time/random), a client Layer that differs from the server Layer (only a mismatch if output differs), a Boundary fallback rendered on the server that succeeds on the client, browser-mutated DOM, parser-normalised DOM (tbody, p auto-close) classified as a documented non-goal.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/dom.ts` plan/apply and abort (~l.366-430)

## Acceptance
- [ ] Deliberate mismatch reports `HydrationMismatch` and the final DOM equals a fresh client render (R4).
- [ ] Each named case has a test; HydrationMismatch is a runtime error class, not an AnalyzeCode.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
