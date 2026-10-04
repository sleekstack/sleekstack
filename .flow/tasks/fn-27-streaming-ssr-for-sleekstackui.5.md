---
satisfies: [R3]
---
# fn-27-streaming-ssr-for-sleekstackui.5 ui stream: late-boundary hydration and missing-chunk report

## Description
fn-27 owns the late-boundary hook (fn-25 only left a seam): hydration skips boundaries whose chunk has not arrived and adopts each when it lands; a stream that ends with unresolved placeholders reports.

**Size:** M
**Files:** packages/ui/src/dom.ts (or hydrate.ts), packages/ui/src/stream.ts, packages/ui/src/__tests__/stream.test.ts
**Touches:** [packages/ui/src/dom.ts, packages/ui/src/hydrate.ts, packages/ui/src/stream.ts, packages/ui/src/__tests__/stream*]

### Approach
- A stream-end marker script lets the client report unresolved placeholders to `onError`; a chunk for an already-adopted boundary is ignored.

### Investigation targets
**Required** (read before coding):
- the seam fn-25 left in `packages/ui/src/pending.ts`/hydrate

## Acceptance
- [ ] Hydrating mid-stream ends in the same DOM as a fully loaded hydrate (R3).
- [ ] A missing chunk leaves the fallback and reports.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
