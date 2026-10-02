---
satisfies: [R5]
---
# fn-13-runtime-package-request-aware-graph.6 Docs, ADR 0013, CONTEXT and READMEs

Touches: docs/adr/**, CONTEXT.md, README.md, packages/*/README.md, apps/docs/content/**

## Description
**Task 5 drift (document):** the atom registry is the `@sleekstack/react/internal` subpath (dev-only, `@internal`, excluded from docs entry points; also exports `useProviderAtomStore`); `LayerProvider`/`managedScope` append to a fixed `globalThis` rendezvous list the registry reads (late-load safe); core `AtomStore.inspect()` is an `@internal` read-only enumeration returning `{ atom, label, value }`; the panel dedupes prop atoms only against its own provider's store.

**Drift from tasks 1, 2, 4 (document these):** runtime internals live at `@sleekstack/runtime/internal` (excluded from docs entry points); kit sets `isControlFlow: isNextControlFlow`; a classified value thrown during the app build is rethrown untouched. No Supervisor/Tracer is installed (a user's Tracer is untouched): fiber ids come from `Effect.fiberId` in a per-service hook and the owning scope from a FiberRef set around the app build and each runEffect call; event ids equal the analyzer's bare Tag-key node ids, one acquire/release per provided Tag; raw request layers emit one whole-layer event labeled `request`; `--lenient` covers runEffect request/overrides layers only; Report roots carry `kind`.

**Touches:** docs/adr (0013, 0012 status note, README index), CONTEXT.md, root and package READMEs, apps/docs content

Write ADR 0013 (supersedes the package-boundary part of ADR 0012; 0014 stays reserved for fn-12). Add CONTEXT.md terms: runtime package, request root, overrides root. Update next/runtime/devtools/react READMEs and docs pages (nextjs, errors, kit-vs-effect) for the new boundary, the `--lenient` flag and the atom registry. Remove stale `@sleekstack/next` references to moved APIs.

## Acceptance
- [ ] ADR 0013 added, ADR 0012 carries a superseded-in-part note, adr README indexed
- [ ] CONTEXT.md terms added; no doc references the old package for moved APIs
- [ ] docs api-coverage test and docs build pass

## Done summary
Added ADR 0013 (runtime in `@sleekstack/runtime`, `@sleekstack/next` is its Next preset; supersedes ADR 0012's package boundary), with a superseded-in-part note on 0012 and an index row. CONTEXT.md gains Runtime Package, Request Root and Overrides Root and an updated Analyzer (`--lenient`), Graph, Request Scope, Action and Devtools. Root README, docs index/nextjs/errors/testing/kit-vs-effect/getting-started-effect, and the devtools and react READMEs now describe the new boundary, request/overrides roots, `--lenient`, per-service devtools events and the dev atom store list. kit-vs-effect no longer names the removed core `service()`.

Notes: CONTEXT keeps AtomStore's "Avoid: atom registry", so the term is not added there; the code's `@sleekstack/react/internal` registry is described as a store list. The generated API pages were left as generated. runtime and next READMEs were already current.

baseline: none run pre-edit (docs-only diff); gate classify returned full, so full gates ran post-edit: all green
Tier: implementer tier, project routing block (opus at medium)

stage: impl-review - ran (codex: triage_skip docs-only, SHIP)
## Evidence
- Commits: e216216c3d49e66bd2d615ad694b4664b62fc27b
- Tests: pnpm typecheck && pnpm test, pnpm --filter showcase build && pnpm --filter showcase test, pnpm --filter docs test, pnpm --filter docs build
- PRs: