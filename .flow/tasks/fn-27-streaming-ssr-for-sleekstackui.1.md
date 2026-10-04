---
satisfies: [R1]
---
# fn-27-streaming-ssr-for-sleekstackui.1 ui stream: serializer core, shell flush, placeholders, store lifetime (proof point)

## Description
Early proof point. `renderToStream(app, { layer, nonce, idPrefix, onError })` returns a `ReadableStream<Uint8Array>`; the shell flushes first with each unresolved Pending as a placeholder carrying a unique id. Decisions: the stream emits no resume manifest; the store, scopes and fibers live until the last boundary resolves and are disposed on complete, error or cancel.

**Size:** L
**Files:** packages/ui/src/stream.ts (new), packages/ui/src/string.ts, packages/ui/src/component.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/stream.test.ts (new)
**Touches:** [packages/ui/src/stream.ts, packages/ui/src/string.ts, packages/ui/src/component.ts, packages/ui/src/index.ts, packages/ui/src/__tests__/stream.test.ts]

### Approach
- Share one `serialize` between renderToString and renderToStream so `renderToString` output is unchanged; Pending content must be awaited outside the synchronous `serialize` (substitute resolved nodes or an async serializer).
- Provide a RenderScope for the stream and a cancellable runner (`runFork` + `Fiber.interrupt`); `runToNode` has no abort handle.
- Validate `idPrefix` with `checkId`/the ID regex; reuse `scriptJson`, `escape`.
- Draft the protocol ADR text in the task summary for task 6. Wrappers and separators follow fn-25's markup.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/string.ts` renderToString/serialize/scriptJson/checkId (~l.11-136)
- `packages/ui/src/component.ts` runToNode (~l.38-60)
- `packages/ui/src/pending.ts` and the `pending` field from fn-24
- packages/islands/src/__tests__/ssr.test.tsx l.17,30 (draining a stream via Response)

## Acceptance
- [ ] First chunk contains the shell and fallbacks without waiting for any pending boundary (R1).
- [ ] A render defect before flush rejects the stream.
- [ ] Zero-pending trees produce shell and close; `renderToString` output unchanged.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
