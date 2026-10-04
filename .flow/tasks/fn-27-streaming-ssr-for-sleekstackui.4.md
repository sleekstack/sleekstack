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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
