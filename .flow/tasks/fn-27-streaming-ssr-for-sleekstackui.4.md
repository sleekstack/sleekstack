---
satisfies: [R3]
---
# fn-27-streaming-ssr-for-sleekstackui.4 ui stream: per-boundary state in chunks

## Description
Each chunk carries its own dehydrated atom and query state (fn-25 format, `data-sleek-hydrate`-style payload) so the client Pending does not rerun content or refetch.

**Size:** S
**Files:** packages/ui/src/stream.ts, packages/ui/src/string.ts, packages/ui/src/dom.ts (or hydrate.ts), packages/ui/src/__tests__/stream.test.ts
**Touches:** [packages/ui/src/stream.ts, packages/ui/src/string.ts, packages/ui/src/dom.ts, packages/ui/src/hydrate.ts, packages/ui/src/__tests__/stream*]

### Approach
- Decision: one Collector for the whole stream (DuplicateBindKey/DuplicateHandler must persist across chunks); each chunk contains only atoms changed since the previous chunk; the client merges with core `hydrate` and repeated query hydration (verify it merges).

### Investigation targets
**Required** (read before coding):
- packages/core/src/atom/AtomStore.ts dehydrate/hydrate
- `packages/ui/src/string.ts` Collector (~l.35-39, 84)

## Acceptance
- [ ] A client that hydrates a streamed boundary does not refetch its state (R3 state half).

## Done summary
renderToStream now appends a `data-sleek-hydrate` payload (string.ts `payload`, now exported) to the shell and before each chunk's `<template>`, holding only atoms (by encoded JSON) and queries (by queryHash+dataUpdatedAt) changed since the previous flush; one Collector spans the stream. The QueryClient is read from the built layer context. hydrateMount's readPayload now reads every top-level `script[data-sleek-hydrate]` in the container, merging atoms in order (later wins, since core `hydrate` keeps the first value per key) and concatenating queries; a malformed one is reported and skipped.

Test: stream.test.ts "each chunk carries its new atom and query state; hydrating the streamed DOM does not refetch" (red without the hydrate.ts change).

Notes for .5: payloads are read only once, at hydrateMount; chunks arriving later are not yet merged. Payload scripts sit at the stream's top level (container children), outside templates. No resume manifest in the stream. An unhandled post-flush failure sends no chunk and no payload.

stage: impl-review - skipped(config: no review requested by conductor)
## Evidence
- Commits: a77e7e330df44d4103253e1964ce681bdce4eeed
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui... --filter=ui-demo
- PRs: