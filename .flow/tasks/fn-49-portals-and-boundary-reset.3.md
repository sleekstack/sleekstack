---
satisfies: [R7]
---
# fn-49-portals-and-boundary-reset.3 Docs

## Description
Docs. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** packages/ui/README.md, CONTEXT.md (Portal term)
**Touches:** [packages/ui/README.md, CONTEXT.md]

### Approach
- Document Portal and the fallback's `reset`; add the Portal term to CONTEXT.md; one example each.

## Acceptance
- [ ] README documents Portal and reset (R7)


## Done summary
README gains a `Portal` / `PortalContainerMissing` row plus Boundary `reset` and Portal examples; CONTEXT.md gains the Portal term. Boundary reset prose and ADR 0035 already landed in .1.

Tier: implementer opus at medium
stage: impl-review - ran (codex triage_skip: docs-only, SHIP)
## Evidence
- Commits: e0206d0b11ee28b2a97643ea569370e62c79f69f
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/ui
- PRs: