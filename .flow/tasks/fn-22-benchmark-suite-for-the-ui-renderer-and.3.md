---
satisfies: [R4]
---
# fn-22-benchmark-suite-for-the-ui-renderer-and.3 bench: JSX wrapper overhead suite

## Description
Benchmark `renderToString` of a non-reactive tree built through `jsx()` against the same components called directly (bypassing the instance wrapper), and a reactive tree with one atom read, so the fn-19 claim has a number.

**Size:** M
**Files:** `apps/bench/src/jsx-overhead.bench.ts`

### Approach
- Correctness check: both routes produce identical HTML.
- Case names carry the group needed by the ratio gate (`direct` is the in-suite reference).

### Investigation targets
**Required**:
- `packages/ui/src/jsx-runtime.ts`
- `packages/ui/src/reactive.ts`

### Key context
Spec `.flow/specs/fn-22-benchmark-suite-for-the-ui-renderer-and.md` is authoritative; its Architecture section defines the scenario model, result format and ratio gate.

## Acceptance
- [ ] The suite reports wrapper and direct timings for the same non-reactive tree
- [ ] Outputs verified identical before measuring
- [ ] Case naming exposes the reference case for `compare`

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
