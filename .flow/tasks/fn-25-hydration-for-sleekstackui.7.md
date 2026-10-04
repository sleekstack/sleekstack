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
While hydrating, Pending awaits its content inline, the same way the server does, and emits it on the first adopt. It shows no fallback and causes no mismatch. A mutable `Hydrating` cell (pending.ts), provided in dom.ts `start` and switched off after the first run, drives this, so captured re-run contexts fork as usual. While hydrating, Pending's reads go to a scratch collector, so the client also emits no instance host, which matches the server markup. The content slot is still allocated. The internal seam `adoptLateBoundary` (a no-op) is left in pending.ts for fn-27 and is not exported from index.

Known ceiling: the first parent re-run after hydration turns the Pending into a reactive instance, which rebuilds its DOM once. It keeps showing the stored content, not the fallback. Follow-up: have the server emit a host for Pending (string.ts) if node identity matters there.

Test: hydrate.test.ts "hydrateMount Pending (R2)". It failed with HydrationMismatch before the fix.
baseline: green via handoff (verified at 6d2619b by fn-25.6)
Tier: implementer: opus at medium (project routing block)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: fb8f53f0bb78767c4184b27f3a50c93b279dbef1
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui...
- PRs: