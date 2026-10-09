---
satisfies: [R8, R14]
---
# fn-50-sleekstackrouter.1 Settle the router specs and write the ADR

## Description
Settle the router specs and write the ADR. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** .flow/specs fn-28, fn-29, fn-30, fn-32 and fn-50, docs/adr (next number after 0030, check for collisions)
**Touches:** [.flow/specs/**, docs/adr/**]

### Approach
- Close fn-28 as superseded and mark fn-32 absorbed (move its redirect/not-found/handle scope into fn-50 criteria); re-point fn-29 (Vite plugin: no TanStack generator, file routes feed `@sleekstack/router`) and fn-30 (SSG) and add them as dependents; update the dependency edges with flowctl.
- ADR: drop TanStack router-core for a const route table with params inferred from path strings (fn-42.D3), packages boundary like ADR 0025.

## Acceptance
- [ ] fn-28 and fn-32 resolved, fn-29/fn-30 re-pointed (R8)
- [ ] ADR written and indexed (R14)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
