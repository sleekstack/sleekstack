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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
