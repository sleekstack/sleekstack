---
satisfies: [R5]
---
# fn-24-pending-async-boundaries-for.3 ui: renderToString awaits Pending content, no fallback markup

## Description
Under `renderToString` there is no RenderScope, so Pending must run its content inline and await it, emitting content only. Carries the `{fallback, content}` pair on the node for fn-27.

**Size:** M
**Files:** packages/ui/src/string.ts, packages/ui/src/component.ts, packages/ui/src/pending.ts, packages/ui/src/__tests__/string.test.ts
**Touches:** [packages/ui/src/string.ts, packages/ui/src/component.ts, packages/ui/src/pending.ts, packages/ui/src/__tests__/string.test.ts]

### Approach
- Take the no-scope branch in Pending (like `Provider`'s) so content is awaited inside `runToNode` before `serialize` runs; `serialize` stays synchronous.
- Do not change output for trees without Pending (existing string tests pin exact HTML).
- A failing child surfaces its typed error exactly as before; there is no timeout: a never-resolving child hangs, documented in the README task.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/string.ts` renderToString/serialize (~l.80-136)
- `packages/ui/src/component.ts` runToNode (~l.38-49)
- `packages/ui/src/__tests__/string.test.ts`

## Acceptance
- [ ] Pending content appears in `renderToString` output; no fallback markup appears (R5).
- [ ] Output for non-Pending trees is byte-identical (existing string tests unchanged).
- [ ] A failing child rejects with its typed error; `useQuery` components behave as before.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
