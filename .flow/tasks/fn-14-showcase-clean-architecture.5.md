---
satisfies: [R11]
---
# fn-14-showcase-clean-architecture.5 README: mapping table and file layout

## Description
Migration step 5. Update apps/showcase/README.md mapping table and file layout to the new structure; note BoardStore is a single-adapter seam kept as a Tag for the Graph demo, and ActivityLog/Clock are real seams (live + demo).

## Acceptance
- [ ] README table and layout match the tree on disk (R11)
- [ ] Tests still green

## Done summary
Rewrote apps/showcase/README.md for the layered tree: a Layout section, the dependency rule with its one composition-boundary exception (delivery/runtime.server.ts -> infrastructure/app.ts), the BoardStore single-adapter note, ActivityLog/Clock as live+demo seams, and the R1-R11 table plus Models section repointed to real paths (every path verified to exist).

stage: impl-review - ran (codex route; triage_skip SHIP, docs-only)
Tier: implementer opus at medium
## Evidence
- Commits: 41d34fa413acfdf5a04090b58fdda644be5a8be2
- Tests: GATE_SKIPPED:typecheck:docs-only - cumulative diff classified tier-B (no executable paths touched), GATE_SKIPPED:test:docs-only - cumulative diff classified tier-B (no executable paths touched), README path existence check (all referenced paths exist)
- PRs: