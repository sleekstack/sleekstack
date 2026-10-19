---
satisfies: [R9]
---
# fn-60-docs-site-on-ui-and-start.7 records: ADR, docs README, CONTEXT and AGENTS.md, and unblock the removal spec

## Description
Record the work and hand over to the removal spec (fn-55): its deletion task must be able to run, and its docs-content task must be reconciled with what this spec already did.

**Size:** S
**Files:** docs/adr/ (next free number) and the index; apps/docs/README.md; CONTEXT.md; AGENTS.md; .flow/specs/fn-34-* and fn-55-* and its task fn-55.7 (through flowctl)
**Touches:** [docs/adr/**, apps/docs/README.md, CONTEXT.md, AGENTS.md, .flow/specs/fn-34-*, .flow/specs/fn-55-*, .flow/tasks/fn-55-*]

### Approach
- ADR: the docs site on ui and start: static output with start only in dev, plain CSS, search from a build-time index, base-prefix routes, what fumadocs features were dropped (from the D1 inventory). Read every handover first.
- Run fn-55 task 6's precondition search over `apps/docs` for the four package names (positive control first) and record that it passes.
- fn-55 task 7 (docs content, generated API docs, ADR, CONTEXT, AGENTS.md): mark which parts this spec already did and trim that task through flowctl so work is not repeated; mark fn-34 superseded.
- AGENTS.md: the docs verify row and any command changes (`dev`, `build`, `typecheck`).

### Investigation targets
**Required**:
- `.flow/tmp/handover/` summaries of tasks .1 to .6 (if present)
- `docs/adr/README.md`, `CONTEXT.md`, `AGENTS.md`, `apps/docs/README.md`
- `.flow/specs/fn-55-remove-kit-react-next-and-islands.md` and tasks .6 and .7
- `.flow/specs/fn-34-ui-api-reference-in-the-docs-site.md`

## Acceptance
- [ ] ADR indexed; docs README, CONTEXT and AGENTS.md describe the new site and commands
- [ ] The fn-55 task 6 precondition search over `apps/docs` finds nothing, recorded
- [ ] fn-55 task 7 is trimmed to what remains; fn-34 is marked superseded
- [ ] `pnpm turbo run test typecheck --filter=docs` and the root `pnpm test` are green

## Done summary
Wrote ADR 0048 (was 0044 before the merge with master; docs site on ui and start; supersedes 0007, indexed), CONTEXT Docs Site term, AGENTS docs row. Unblocked fn-55: task 7 trimmed to the records not done here; tasks 5 and 6 now carry the kit/llms.md precondition (initAgents and the analyze llms test read it); fn-55 depends on fn-60; fn-34 marked superseded and closed (dropped when merged with master, where fn-34 shipped as its own work). R8 search of apps/docs for the four packages: none (positive control hit packages/next). Docs test/typecheck and format:check green. Tier: opus at medium.

stage: impl-review - skipped(policy: standing user rule, no per-task review)
## Evidence
- Commits: 9eab2217f6b0851b06d5fb176b3b680b12c0adf8
- Tests: pnpm turbo run test typecheck --filter=docs, pnpm format:check
- PRs: