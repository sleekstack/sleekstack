---
satisfies: [R8]
---
# fn-9-static-build-time-dependency-graph.8 ADR superseding 0004-0006, CONTEXT, docs, READMEs

## Description
Write the ADR (why 0005's compiler-plugin rejection no longer holds; analyzer lock-in), supersede 0004 / 0005 / 0006 headers, update CONTEXT.md (Graph, captive dependency, effect), docs guides and snippets, kit-vs-effect, nextjs, READMEs and regenerate the API reference; keep the R7 dts test green.

**Size:** S/M
**Files:** docs/adr/*, CONTEXT.md, apps/docs/content/**, apps/docs/snippets/**, packages/*/README.md, CHANGELOG
**Touches:** [docs/adr/**, CONTEXT.md, apps/docs/**, packages/*/README.md]

### Investigation targets
**Required**:
- `docs/adr/0004-hybrid-service-definitions.md`, `0005-dependency-arrays-over-inject.md`, `0006-enforce-module-privacy.md`
- `CONTEXT.md:33-61`

### Acceptance
- [ ] docs vitest and typecheck pass; snapshot / deps-array references gone
- [ ] ADR records the lock-in and the plugin-vs-checker reasoning

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
