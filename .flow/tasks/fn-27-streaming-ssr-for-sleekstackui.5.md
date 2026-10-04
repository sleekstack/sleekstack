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
Late-boundary hydration and the missing-chunk report. Each stream payload now carries a `b` map from boundary id to path (Pendings are numbered per enclosing boundary: `0`, `1`, `1.0`). When `hydrateMount` finds a placeholder still on screen, the matching Pending (numbered the same way, in run order) hydrates its fallback and registers a `Late` entry (pending.ts). The hydrate walk skips the `sleek-p` comments and records a Mark for that fallback. hydrate.ts `landing` wraps `self.__sleekSwap`: when a chunk lands, it runs the stock swap, seeds the chunk's payload, runs the content with hydration on, then adopts the swapped nodes in place of the fallback lives. Landings run one at a time, after the walk, so nested chunks land after their parent. A chunk for a boundary that was already adopted is ignored. At the end of a stream, if some boundaries never got a chunk, the server emits `__sleekEnd([ids])`. The client reports each of those ids as `BoundaryChunkMissing` (exported, README row added) and keeps the fallback. This works whether the client hydrated before the stream ended (live hook) or after (`self.__sleekGone`). The `adoptLateBoundary` seam is deleted and ADR 0015 is updated.

Tests: stream.test.ts "hydrating mid-stream adopts each boundary as its chunk lands..." (nested, query, final innerHTML equals a fully loaded hydrate, calls 1) and "a chunk that never arrives...". Two existing assertions now compare after `normalize`, and `apply` runs only scripts without a `type`. Both changes follow from the shell now carrying a JSON payload script, and spec R2 allows normalising. The payload script now carries the nonce.

Loose ends: an atom already built on the client is not updated from a later chunk, because core `hydrate` keeps the first value; atoms seed only when new. If the content run fails after the swap, the server DOM stays with no client lives behind it. The swap hook is page-global: a later stream's shell redefines `__sleekSwap` and bypasses the wrapper. The numbering relies on sequential (preorder) runs. fn-25's silent fallback for a missing payload is not in this spec's R5, so it was left alone.

stage: impl-review - skipped(config: no review requested by conductor)
## Evidence
- Commits: 2ca0b70a5a80de8cb790defac637904703e84e5f
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo
- PRs: