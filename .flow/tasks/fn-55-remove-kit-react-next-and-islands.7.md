---
satisfies: [R6]
---
# fn-55-remove-kit-react-next-and-islands.7 records: removal ADR, superseded markers, CONTEXT and AGENTS.md (docs content done by fn-60)

## Description
Bring the remaining records in line with the removal. The docs-site rebuild (fn-60) already did the docs content part: pages and snippets of kit, react, next and islands are deleted, the remaining guides and snippets are rewritten on core, ui, query and start, and the generated API reference covers only surviving packages (ui and start included). Do not redo it; only re-check it.

**Size:** S
**Files:** docs/adr/ (new ADR, next free number after 0044) and README row, superseded markers on earlier ADRs, CONTEXT.md, AGENTS.md
**Touches:** [docs/adr/**, CONTEXT.md, AGENTS.md]

### Approach
- Already done by fn-60 (skip): docs pages and snippets, meta.json, generated API pages, ADR 0044 (docs site), AGENTS.md docs row, `apps/docs` free of the four packages.
- One new ADR records the removal and that Redirect/NotFound and the runtime feed live where they now do; earlier ADRs for the removed packages (0004, 0009 to 0013, 0018, 0019) get a superseded status line pointing at it. ADR 0040 is taken (model package); use the next free number.
- CONTEXT.md: drop the Kit facade, React integration, Island and Next.js integration terms and the intro wording; keep Request Scope, Runtime Package and Devtools accurate for the surviving packages.
- AGENTS.md: verify table rows and the fixture graph check use only remaining packages and fixtures (the `kit-app` fixture and the kit and react rows go).
- Confirm `apps/docs` still has no reference to the four packages (grep with a positive control).

### Investigation targets
**Required**:
- `CONTEXT.md` (Kit facade, React integration, Next.js integration sections)
- `AGENTS.md`, `docs/adr/README.md`
- ADRs 0004, 0009 to 0013, 0018, 0019 for status lines
## Acceptance
- [ ] New ADR indexed; ADRs of removed packages marked superseded; CONTEXT and AGENTS.md match the remaining packages
- [ ] A grep of `apps/docs` for the four package names finds nothing; `pnpm turbo run test typecheck --filter=docs` and the root `pnpm test` are green
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
