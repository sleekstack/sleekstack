---
satisfies: [R10]
---
# fn-59-docs-build-platform-on-ui-and-start.7 records: ADRs, AGENTS.md, CONTEXT, size budget and the trimmed fn-29, fn-30, fn-33

## Description
Record the work: ADR(s) for the decisions, the package README, AGENTS.md verify row, CONTEXT terms, ui's re-measured size budget, and the open specs fn-29, fn-30 and fn-33 trimmed or marked superseded.

**Size:** S
**Files:** docs/adr/ (next free number) and the ADR index; packages/ui-vite/README.md; AGENTS.md; CONTEXT.md; apps/showcase/test/size.test.ts and ADR 0022's size table; .flow/specs/fn-29-*, fn-30-*, fn-33-* (through flowctl)
**Touches:** [docs/adr/**, packages/ui-vite/README.md, AGENTS.md, CONTEXT.md, apps/showcase/test/size.test.ts, .flow/specs/fn-29-*, .flow/specs/fn-30-*, .flow/specs/fn-33-*]

### Approach
- ADR content: MDX compile choices (options, plugins, style-to-class), the head contract and stream policy chosen in task .2, routes with a base prefix, prerender with start only in dev, the search index design, Open Graph with satori and resvg and the site-origin requirement, void-element fix. Read every handover summary first.
- CONTEXT terms: Head, HeadSink, Prerender (check the terms do not clash with `_Avoid_` lines).
- fn-29, fn-30, fn-33: for each, say what this spec delivered and trim the spec to what is left (HMR stays fn-31; file-based routes beyond the table, deploy adapters and stable component ids stay); use `flowctl spec` verbs, never hand edits of specs that have tasks.
- Re-measure ui's size entries with the showcase size test and record the numbers in ADR 0022's table.

### Investigation targets
**Required**:
- `.flow/tmp/handover/` summaries of tasks .1 to .6 (if present) and the commit history of this spec
- `docs/adr/README.md`, ADR 0022, `CONTEXT.md`, `AGENTS.md`
- `.flow/specs/fn-29-*`, `fn-30-*`, `fn-33-*`

## Acceptance
- [ ] ADR(s) indexed; package README lists options and exports; AGENTS.md has a verify row for `packages/ui-vite`; CONTEXT terms added
- [ ] ui's size entries re-measured and recorded in ADR 0022
- [ ] fn-29, fn-30 and fn-33 each state what was delivered and what remains
- [ ] `pnpm turbo run test typecheck --filter=showcase --filter=@sleekstack/ui-vite...` is green

## Done summary
Recorded fn-59: ADR 0042 (void elements, Head, stream patch, hydration) and 0043 (MDX, routes, prerender, search, OG, packaging), indexed; ui-vite README exports/options; AGENTS verify row; CONTEXT Head, HeadSink, Prerender; ADR 0022 re-measured (limits unchanged, 44-56 B headroom); fn-29, fn-30, fn-33 trimmed via spec set-plan.

stage: impl-review - skipped(policy: standing user rule, no per-task review)
## Evidence
- Commits: 74d8c87274c1dd8d7e8dfd5f2e0cdd751c91c73d
- Tests: pnpm turbo run test typecheck --filter=showcase --filter=@sleekstack/ui-vite... (green), pnpm format:check (green)
- PRs: