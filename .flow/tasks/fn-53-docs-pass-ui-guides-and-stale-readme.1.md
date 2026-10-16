---
satisfies: [R1, R2, R3, R4, R5, R6, R7]
---
# fn-53-docs-pass-ui-guides-and-stale-readme.1 ui guides, typed DOM/lazy/transition/portal pages and README refresh

## Description
Audit then write: docs-site ui guide and feature pages (R1-R3) with typechecked snippets in apps/docs/snippets, meta.json order, showcase page links; README refresh for the root and every package (R4), CONTEXT.md consistency (R5). Read each package's src/index.ts to make the export tables exact. **Touches:** apps/docs/**, README.md, packages/*/README.md, CONTEXT.md

## Acceptance
- R1-R7 hold
- pnpm turbo run test typecheck --filter=docs green; pnpm --filter docs build passes the link check

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
