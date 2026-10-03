---
satisfies: [R6, R9]
---
# fn-22-benchmark-suite-for-the-ui-renderer-and.4 bench: compare script with ratio gate and unit tests

## Description
`compare` reads `results/latest.json` and `baseline.json`, computes ratio = SleekStack mean / same-run reference mean (jotai for atoms, React for render, in-suite `direct` for jsx-overhead), and flags `REGRESSED` when the ratio exceeds the baseline ratio by more than 50% (per-case override allowed).

**Size:** M
**Files:** `apps/bench/scripts/compare.ts`, `apps/bench/src/__tests__/compare.test.ts`, `apps/bench/src/__tests__/fixtures/*.json`, `apps/bench/package.json`

### Approach
- Markers: `NEW` (no baseline, not a failure), `MISSING` (baseline case absent from results, fails), `NOISY` (rme > 20%, excluded from the gate). Exit 0 / 1 / 2; markdown table on stdout; malformed input exits 2 naming the file.
- Keep the logic in a pure function so the fixture-based tests need no process spawn; add `update-baseline` script writing `baseline.json` from `latest.json`.
- Fixture tests: regression, improvement, NEW, MISSING, NOISY, malformed JSON.

### Investigation targets
**Required**:
- `apps/bench/src/scenarios.ts` (result format written in task 1)

### Key context
Spec `.flow/specs/fn-22-benchmark-suite-for-the-ui-renderer-and.md` is authoritative; its Architecture section defines the scenario model, result format and ratio gate.

## Acceptance
- [ ] All six fixture cases pass under `pnpm --filter bench test`
- [ ] Exit codes 0/1/2 behave as specified
- [ ] `pnpm test` runs the compare tests and does not run any `*.bench.ts`

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
