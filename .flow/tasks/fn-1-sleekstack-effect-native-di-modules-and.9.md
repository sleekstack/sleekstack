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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
