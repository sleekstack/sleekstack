---
satisfies: [R5, R6]
---
# fn-6-docs-site-with-generated-api-reference.4 Docs refresh + stale-phrase check + CI

## Description
Refresh docs:
- Root README: status, packages (drop kit from Planned), a kit quick example with effect(), the docs site link, and fix line 112's privacy wording.
- CONTEXT.md: state that privacy is enforced; add effect().
- `docs/adr/README.md`: an index of 0001–0007 with status.
- New short READMEs for core, next and react, pointing at the site.
- Check the kit, app and cli READMEs.
- `.claude/CLAUDE.md` Sources of truth: stop naming fn-1 as the active spec.
Add a stale-phrase test ("descriptive graph metadata", "pnpm 10", "pnpm@10") over the tracked `*.md`, excluding docs/adr history and .flow. CI: add apps/docs to ci.yml:27-31 and add docs build and test steps.

Touches: README.md, CONTEXT.md, docs/adr/README.md, packages/*/README.md, apps/*/README.md, .claude/CLAUDE.md, apps/docs/test/**, .github/workflows/ci.yml

## Acceptance
- [ ] Stale-phrase test passes, and fails if a phrase is reintroduced.
- [ ] core/next/react READMEs exist; ADR index lists 0001–0007 with status.
- [ ] CI runs the docs build and test; the workflow lists apps/docs.


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
