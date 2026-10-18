---
satisfies: [R1]
---
# fn-33-head-management-for-ui.2 Head in renderToString

## Description
SSR mode of `HeadSink`: collect tags during `serialize`, expose the head string via `renderToString` options/return; same dedupe and deepest-wins as DOM.

**Size:** S
**Files:** packages/ui/src/string.ts, packages/ui/src/head.ts, packages/ui/src/__tests__/string.test.ts
**Touches:** [packages/ui/src/string.ts, packages/ui/src/head.ts, packages/ui/src/__tests__/string.test.ts]

### Approach
- Extend `renderToString` (`string.ts:186`) following how the `Collector` interface (`string.ts:39`) is threaded.
- Attribute values escaped with `escape`; invalid attrs throw via `checkAttr`.

### Investigation targets
**Required**:
- `packages/ui/src/string.ts:39-60,134-200`

## Acceptance
- [ ] Head string includes title/meta/link, nested override wins
- [ ] Escaping and invalid-attr rejection tested

## Done summary
`renderToString` now takes `onHead(html)` and passes it the `Head` tags' markup. `Head` marks its output node with its depth, tags and errors (`headOf` in string.ts). `serialize` collects these marks in document order, and `headHtml` dedupes them the way the DOM does: the deepest wins, the last on a tie, and each key keeps the place where it first appeared. Attribute values and title text are escaped. An invalid head tag reports to `onError` and then rejects the render, the same as an invalid element. `meta` and `link` now reject content. Tests are in packages/ui/src/__tests__/string.test.ts, under `renderToString > Head`.

Note for .3: `renderToStream` already goes through `serialize`, so it rejects invalid head tags today. It needs a `head` array on its Collector and a shell/late-change policy.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK, 1 finding: SSR head errors not reported to onError; fixed; re-review SHIP)
## Evidence
- Commits: a8d1ebf4169ed745d5e49af1757b139f4b5d4e36, 49bbfa8bb3af6ff34fddfbd6884fbcdda31ac48a
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui...
- PRs: