---
satisfies: [R6, R7, R8]
---
# fn-47-transitions-and-deferred-atoms.3 Bench, size budget, ADR and README

## Description
Bench, size budget, ADR and README. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** apps/bench/src (scenario), apps/ui-demo/test/size.test.ts + docs/adr/0022 table, a new ADR (next number after 0030), packages/ui/README.md
**Touches:** [apps/bench/**, apps/ui-demo/test/size.test.ts, docs/adr/**, packages/ui/README.md]

### Approach
- Add one bench scenario for a transition and a deferred read; the size limits and ADR 0022's table change together if a deliberate increase is recorded.
- ADR: transition semantics without concurrent lanes and its limit. Measure after fn-48's budget change lands to avoid two measurements.

## Acceptance
- [ ] Bench scenario present, no REGRESSED rows (R6)
- [ ] ADR written (R7)
- [ ] README documents both APIs (R8)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
