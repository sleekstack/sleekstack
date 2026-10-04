---
satisfies: [R2]
---
# fn-25-hydration-for-sleekstackui.7 ui hydrate: Pending boundaries during hydration

## Description
Decision: server `renderToString` awaits Pending (fn-24), so while hydrating a Pending runs its content before the first adopt, without a fallback; the late-boundary arrival mechanism belongs to fn-27.

**Size:** S
**Files:** packages/ui/src/pending.ts, packages/ui/src/dom.ts (or hydrate.ts), packages/ui/src/__tests__/hydrate.test.ts
**Touches:** [packages/ui/src/pending.ts, packages/ui/src/dom.ts, packages/ui/src/hydrate.ts, packages/ui/src/__tests__/hydrate*]

### Approach
- Add a hydrating flag to the run context that Pending reads (as it reads `RenderScope`) to resolve content inline.
- Leave a typed no-op seam for fn-27 to adopt late boundaries.

### Investigation targets
**Required** (read before coding):
- `packages/ui/src/pending.ts` from fn-24
- `packages/ui/src/dom.ts` mount front half

## Acceptance
- [ ] A server-rendered Pending hydrates with no fallback flash and no mismatch (R2/R4).
- [ ] The seam is exported only internally.

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
