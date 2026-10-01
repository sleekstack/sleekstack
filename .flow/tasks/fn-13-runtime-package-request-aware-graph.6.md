---
satisfies: [R5]
---
# fn-13-runtime-package-request-aware-graph.6 Docs, ADR 0013, CONTEXT and READMEs

Touches: docs/adr/**, CONTEXT.md, README.md, packages/*/README.md, apps/docs/content/**

## Description
**Touches:** docs/adr (0013, 0012 status note, README index), CONTEXT.md, root and package READMEs, apps/docs content

Write ADR 0013 (supersedes the package-boundary part of ADR 0012; 0014 stays reserved for fn-12). Add CONTEXT.md terms: runtime package, request root, overrides root. Update next/runtime/devtools/react READMEs and docs pages (nextjs, errors, kit-vs-effect) for the new boundary, the `--lenient` flag and the atom registry. Remove stale `@sleekstack/next` references to moved APIs.

## Acceptance
- [ ] ADR 0013 added, ADR 0012 carries a superseded-in-part note, adr README indexed
- [ ] CONTEXT.md terms added; no doc references the old package for moved APIs
- [ ] docs api-coverage test and docs build pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
