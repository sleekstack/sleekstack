---
satisfies: [R1, R4]
---
# fn-6-docs-site-with-generated-api-reference.3 Guides with typechecked snippets + ADR 0007

## Description
Write the MDX guides from spec Scope: Introduction; Getting started (kit); Getting started (Effect); Concepts; kit vs Effect-native; Next.js; React; Side effects; Errors (every code); Testing; Showcases. Every code sample lives in `apps/docs/snippets/**` (or is a showcase source) and is included into the MDX. Add sidebar `meta.json`. Update docs/adr with ADR 0007 (Fumadocs + generated reference).

Touches: apps/docs/content/docs/** (non-api), apps/docs/snippets/**, apps/docs/test/guides.test.ts, docs/adr/0007-*.md

## Acceptance
- [ ] All Scope guides exist and appear in navigation.
- [ ] Zero inline-only code blocks in guides (the test asserts that code fences come from includes).
- [ ] Snippets typecheck against the real packages; changing an API signature breaks `pnpm --filter docs typecheck`.


## Done summary
Wrote the 11 Scope guides plus sidebar meta.json; every code sample is an `<include>` of a typechecked file under apps/docs/snippets (tsc proven to fail on API drift), guarded by test/guides.test.ts (pages in nav, no inline fences, includes resolve to snippets/showcases, no orphan snippets). Added ADR 0007. Out-of-Touches: `effect` added as apps/docs devDependency (+ lockfile) so Effect-native snippets resolve.

Tier: opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK -> fixed 'use server' wrappers + ModuleCycle hint -> SHIP)
## Evidence
- Commits: f0ff3d3f6181f4d54b524e1288bcfba26385146f, ecef490b006f93d6cf175c276893a1ffca455f84
- Tests: pnpm --filter docs typecheck, pnpm --filter docs build, pnpm --filter docs test, baseline: green via handoff (verified at 497d7c3 by .2)
- PRs: