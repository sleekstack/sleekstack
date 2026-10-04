---
satisfies: [R5, R6]
---
# fn-27-streaming-ssr-for-sleekstackui.6 ui-demo stream route, multi-stream collision test, protocol ADR, README

## Description
Docs and end-to-end proof.

**Size:** S
**Files:** apps/ui-demo/test/stream.test.ts (new), docs/adr/0021-*.md (check next free number), docs/adr/README.md, packages/ui/README.md
**Touches:** [apps/ui-demo/test/stream.test.ts, docs/adr/**, packages/ui/README.md]

### Approach
- Two streams on one page must not collide ids (idPrefix); ADR records the placeholder/chunk/swap protocol, nonce, store lifetime, no resume manifest; README gets a Streaming SSR section.

### Investigation targets
**Required** (read before coding):
- docs/adr/README.md index and the duplicate 0019 gotcha

## Acceptance
- [ ] Two streams on one page do not collide (R5).
- [ ] ADR and README document the protocol (R6).
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo`.

## Done summary
Added ADR 0021 (streaming SSR protocol: shell/comment placeholders, template chunks + __sleekSwap, b map, __sleekEnd/__sleekGone, swap wrapper, BoundaryChunkMissing, nonce on every inline script incl. payloads, lifetime/no resume manifest, page-global hook + distinct idPrefix), ADR index row, packages/ui README renderToStream row + Streaming SSR section, CONTEXT.md Pending line, and apps/ui-demo/test/stream.test.ts (two streams, idPrefix a-/b-, interleaved on one page, both swap, nonce on all scripts).

Gates: dist deleted, pnpm turbo run test typecheck build -> Tasks: 42 successful, 42 total; flowctl validate --all Valid; bench first run atoms/subscribe-notify n=1000 REGRESSED 0.574 vs 0.362 (core src untouched on branch), rerun 0.347 OK, all OK.

Loose end: a Pending content that returns a plain Node (not an Effect) from flatMap silently ends as a missing chunk (__sleekEnd) with no clearer error.

stage: impl-review - skipped(config: no review requested by conductor)
## Evidence
- Commits: a4dc72d19434212687d74241bcf69cc841ff585a
- Tests: pnpm turbo run test typecheck build, flowctl validate --all, cd apps/bench && pnpm bench:json && pnpm compare
- PRs: