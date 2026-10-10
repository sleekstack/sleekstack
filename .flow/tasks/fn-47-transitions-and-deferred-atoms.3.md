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
Added bench case render-dom/transition-deferred-1-of-1k (sleekstack startTransition + useDeferredAtom vs React startTransition + useDeferredValue; compare reports NEW, no REGRESSED/MISSING). Wrote ADR 0034 (core markedWrites/notifyMarked, transition semantics without lanes and its limit, deferred atom), ADR index row, ui README useDeferredAtom row, core README markedWrites row, CONTEXT.md Transition. Size budget unchanged (all entries under ADR 0022 limits). No docs-site ui pages exist; generate:api produced no diff. No ui-demo demo added (task did not name one). A first bench run showed jsfb/update-every-10th REGRESSED; an A/B with merge-base core/ui src measured the same ratio, so it was baseline noise, and the rerun was OK. showcase-kit `sleekstack check --json` identical before/after.

stage: impl-review - ran (codex: fan-out NEEDS_WORK on missing React reference so compare skipped the case, fixed; re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: 8a2b1af8ca84a1171056e288a1aabf7510982e95, a56cff1e2972ad819bc10e27f6e9a8fff507c57d
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/core... --filter=@sleekstack/analyze --filter=sleekstack --filter=ui-demo --filter=docs --filter=bench, pnpm bench:json && pnpm compare (apps/bench)
- PRs: