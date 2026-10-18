---
satisfies: [R1, R3]
---
# fn-33-head-management-for-ui.3 Head in renderToStream with documented late-change policy

## Description
Stream mode: head tags known at shell flush go in the shell; pick and document the policy for changes after flush (inline patch script with the stream nonce, or per-tag shell-only). `Head` inside `Pending` resolves with its boundary. Record the choice in the new-ADR or docs location the repo uses for decided behavior.

**Size:** M
**Files:** packages/ui/src/stream.ts, packages/ui/src/pending.ts, packages/ui/src/head.ts, packages/ui/src/__tests__/stream.test.ts, docs/adr/ (new ADR)
**Touches:** [packages/ui/src/stream.ts, packages/ui/src/pending.ts, packages/ui/src/head.ts, packages/ui/src/__tests__/stream.test.ts, docs/adr/**]

### Approach
- Follow nonce handling already in `stream.ts`; boundary resolution in `pending.ts` (`BoundaryPath` at line 78).
- Error case: a late change with a policy-excluded tag is ignored deterministically, not thrown.

### Investigation targets
**Required**:
- `packages/ui/src/stream.ts:18-120`
- `packages/ui/src/pending.ts:57-120`
- `docs/adr/` - latest ADR for format

## Acceptance
- [ ] Shell head output matches renderToString for the same tree
- [ ] Late change after flush behaves per documented policy, asserted in a test (R3)
- [ ] Head inside Pending resolves with the boundary
- [ ] ADR written

## Done summary
`renderToStream` takes `onHead(html)` and calls it once, before the first chunk, with the shell's head markup. It uses the same dedupe and markup as `renderToString`, so the same tree gives the same head. After flush, a resolved boundary drops its fallback's head tags and adds its content's. Every `title` or keyed `meta` whose winner changed is patched by `__sleekHead(...)` in that boundary's nonce'd swap script, or removed when no `Head` holds the key any more. `link` and unkeyed tags are shell-only: a late one is ignored, without an error. Head marks are tracked by boundary ownership: fallback and content contexts, with a fallback retired once its content swaps in and content retired when it fails to serialize. Because of that, a `Head` nested in a replaced fallback goes away in either completion order. The decision is ADR 0044 (docs/adr/0044-stream-head-late-changes.md); `headWinners` was split out of `headHtml` in string.ts. Tests are in packages/ui/src/__tests__/stream.test.ts under `renderToStream Head (R1, R3)`: shell head equals the renderToString head, the late-change policy (R3), and nested fallbacks in both orders.

Note for .4: the client's `documentHead` claims existing head tags by key. It should adopt the tags `__sleekHead` patched in the same way, so a client that hydrates mid-stream and a later patch both write the same winner. ADR 0042-void-elements-and-head on fn-59/fn-60 branches also covers stream head, with a different policy (meta only, no removal); expect a conflict when those branches merge.

Tier: implementer opus at medium (actual model: claude-opus-5-5)
stage: impl-review - ran (codex fan-out NEEDS_WORK, 1 finding in all 3 draws: nested-fallback head marks survived outer replacement; fixed with ownership contexts; re-review SHIP)
## Evidence
- Commits: 770e3ce6014edffe35843152ea9149f10adb63b2, 561bd976013928224a0ecbd4040f63487deb9f87
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui...
- PRs: