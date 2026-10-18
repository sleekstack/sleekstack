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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
