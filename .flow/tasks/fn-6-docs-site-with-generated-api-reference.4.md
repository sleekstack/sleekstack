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

Touches: README.md, CONTEXT.md, docs/adr/README.md, packages/*/README.md, apps/*/README.md, .claude/CLAUDE.md, apps/docs/test/stale.test.ts, .github/workflows/ci.yml

## Acceptance
- [ ] Stale-phrase test passes, and fails if a phrase is reintroduced.
- [ ] core/next/react READMEs exist; ADR index lists 0001–0007 with status.
- [ ] CI runs the docs build and test; the workflow lists apps/docs.


## Done summary
Refreshed README (packages table, kit+effect() example, docs link, enforced-privacy wording), CONTEXT.md (Kit Effect), ADR index 0001-0007, new core/next/react READMEs, .claude/CLAUDE.md sources; added apps/docs/test/stale.test.ts (fails on reintroduced phrase, verified); CI lists apps/docs and runs docs build + test. Review fixes (scope widened by conductor): generate-api rewriteAnchors targets the symbol heading the link names; check-links resolves relative links against the page URL like a browser; regression tests in apps/docs/test/links.test.ts.

Tier: opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK: anchor identity + relative-link resolution -> fixed -> re-review SHIP)
## Evidence
- Commits: d67e3988fb5c0924ba3f08bc57c7391ed41efeb8, 34da13b230a7c4481e890a021c14883c818c9178
- Tests: pnpm --filter docs test, pnpm --filter docs build
- PRs: