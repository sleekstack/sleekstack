# fn-1-sleekstack-effect-native-di-modules-and.9 Docs: ADR 0004 hybrid definitions, CONTEXT.md terms, README

## Description
Docs that the new design invalidates.

**Size:** S
**Files:** `docs/adr/0004-hybrid-service-definitions.md`, `docs/adr/0001-middle-path-effect-coupling.md`, `CONTEXT.md`, `README.md`
**Touches:** [docs/adr/**, CONTEXT.md, README.md]

## Approach
- ADR 0004 in the existing MADR-lite shape (decision title, rationale, Considered options with chosen marked); add a superseded-by note on 0001.
- ADR 0002: amend to "exports are descriptive graph metadata; no compile-time or runtime enforcement".
- CONTEXT.md: disambiguate Service (resolved value) vs Service Definition (the helper output); add Lifetime, Graph, Captive Dependency in the `**Term**: ... _Avoid_:` shape.
- README: example + status reflect service/module/lifetimes.

## Investigation targets
**Required:**
- `docs/adr/0001-middle-path-effect-coupling.md:3`
- `CONTEXT.md:17-37`
- `README.md:77-98`

## Acceptance
- [ ] ADR 0004 exists; 0001 points to it
- [ ] ADR 0002 amended (exports descriptive only)
- [ ] CONTEXT.md has new terms, no Service collision
- [ ] README example uses new API

## Done summary
Added ADR 0004 (hybrid service-definition metadata, supersedes ADR 0001's "core exports only module()"); amended ADR 0002 to descriptive-only exports (no compile-time or runtime enforcement, matching the graph snapshot's private flag); added Service Definition, Lifetime, Graph, and Captive Dependency terms to CONTEXT.md with Service disambiguated from Service Definition; refreshed README's example (service()/module()/LayerProvider provide array) and Current Status to reflect the implemented core/next/react surface.

stage: impl-review - ran (codex triage-skip, docs-only diff, verdict SHIP)
## Evidence
- Commits: cae1b54c477b27cea8b66e01975bf9507d724372
- Tests: pnpm typecheck, pnpm test, GATE_SKIPPED:codex-review:triage_skip - docs-only (5 files), verdict SHIP
- PRs: