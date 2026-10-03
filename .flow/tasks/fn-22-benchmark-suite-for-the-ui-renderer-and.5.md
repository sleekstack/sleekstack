---
satisfies: [R7, R10]
---
# fn-22-benchmark-suite-for-the-ui-renderer-and.5 bench: baseline, CI job and README

## Description
Run the suites once locally and commit `baseline.json` via `update-baseline`.

**Size:** M
**Files:** `apps/bench/baseline.json`, `apps/bench/README.md`, `.github/workflows/ci.yml`

### Approach
- Add job `bench` to `ci.yml`: `if: github.event_name == 'pull_request'`, same Node and pnpm setup, run `bench:json` then `compare`, append the markdown table to `$GITHUB_STEP_SUMMARY`; warn (not fail) if the baseline Node major differs.
- README: how to run, how to refresh `baseline.json` and `published.json`, and why ratios are gated, not times.
- Do not add the bench app to the CI "require test/typecheck scripts" list unless it already has both scripts (it does after task 1).

### Investigation targets
**Required**:
- `.github/workflows/ci.yml`

### Key context
Spec `.flow/specs/fn-22-benchmark-suite-for-the-ui-renderer-and.md` is authoritative; its Architecture section defines the scenario model, result format and ratio gate.

## Acceptance
- [ ] The `bench` job runs on pull requests only and fails on a regression
- [ ] The job summary shows the table; the main `Test` job is unchanged and runs no benchmark
- [ ] Baseline committed from one recorded run; README documents the refresh commands

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
