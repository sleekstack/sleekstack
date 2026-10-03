---
satisfies: [R11]
---
# fn-19-reactive-host-subtrees-for-sleekstackui.5 docs: ADR amendment and READMEs for the hooks and Store

## Description
Record the decision and document the API (R11).

**Size:** S
**Files:** `docs/adr/0015-host-first-component-framework.md` (or a new ADR, see Key context), `packages/ui/README.md`, `packages/analyze/README.md`, `CONTEXT.md` if it lists ui terms
**Touches:** [docs/adr/0015-host-first-component-framework.md, packages/ui/README.md, packages/analyze/README.md, CONTEXT.md]

### Approach
- ADR: the automatic mode, context capture, the boundary handler stack, lost guest state, `resume` exclusion, store per mount (spec Decision Context). Extend the existing `## Amendment` section style in `docs/adr/0015-host-first-component-framework.md`, and fix the line that says host components have no state.
- ui README table: add `useAtomValue`, `useSetAtom`, `useAtom`, `Store` and `mount`'s `store` option; mention the re-render-the-component behaviour and guest state loss.
- analyze README: note `Store` is always provided at `mount`.
- Add terms to `CONTEXT.md` only if the file already defines ui terms.

### Investigation targets
**Required**:
- `docs/adr/0015-host-first-component-framework.md`, `docs/adr/README.md`
- `packages/ui/README.md`, `packages/analyze/README.md`, `CONTEXT.md`

### Key context
ADR numbers 0016 and 0017 are claimed by fn-17 and fn-18. Amend 0015 instead of taking a new number unless a reviewer prefers otherwise.

## Acceptance
- [ ] ADR 0015 describes the automatic mode, the context capture, the boundary handler stack, lost guest state and the `resume` exclusion, and no longer says host components have no state
- [ ] ui README documents the three hooks, `Store` and `mount`'s `store` option
- [ ] analyze README says `Store` is always provided at `mount`

## Done summary
ADR 0015 gains an "Amendment: reactive host subtrees" section covering the automatic mode, context capture with renderer-owned run scopes, the Boundary handler stack, lost guest state, the `resume` exclusion and the missing-Store `MissingDependency`. The Consequences line that ruled out host state now points to that amendment. The ui README documents the three hooks, `Store` and `mount`'s `store` option. The analyze README says `Store` is always provided at `mount`. CONTEXT.md gets a ui `Store` term.

Tier: opus at medium
baseline: green via handoff (verified at 788537d by fn-19.4)
stage: impl-review - ran (codex route; deterministic triage_skip docs-only -> SHIP)
GATE_SKIPPED:unittest:docs-only - cumulative diff classified tier-B (no executable paths touched)
## Evidence
- Commits: fba302db747e12d25b097c36b212c2b6f52b1c35
- Tests: pnpm --filter @sleekstack/ui test, GATE_SKIPPED:unittest:docs-only - cumulative diff classified tier-B (no executable paths touched)
- PRs: