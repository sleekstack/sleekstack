---
satisfies: [R1, R4]
---
# fn-6-docs-site-with-generated-api-reference.3 Guides with typechecked snippets + ADR 0007

## Description
Write the MDX guides from spec Scope: Introduction; Getting started (kit); Getting started (Effect); Concepts; kit vs Effect-native; Next.js; React; Side effects; Errors (every code); Testing; Showcases. Every code sample lives in `apps/docs/snippets/**` (or is a showcase source) and is included into the MDX. Add sidebar `meta.json`. Update docs/adr with ADR 0007 (Fumadocs + generated reference).

Touches: apps/docs/content/docs/** (non-api), apps/docs/snippets/**, docs/adr/0007-*.md

## Acceptance
- [ ] All Scope guides exist and appear in navigation.
- [ ] Zero inline-only code blocks in guides (the test asserts that code fences come from includes).
- [ ] Snippets typecheck against the real packages; changing an API signature breaks `pnpm --filter docs typecheck`.


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
