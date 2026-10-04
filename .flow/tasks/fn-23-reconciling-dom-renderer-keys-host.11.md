---
satisfies: [R10]
---
# fn-23-reconciling-dom-renderer-keys-host.11 bench: keyed-reorder and one-of-1000 update cases, keep the gate green

Touches: apps/bench/src/render-dom.bench.ts, apps/bench/src/scenarios.ts, apps/bench/baseline.json, apps/bench/README.md

## Description
Reflect the reconciler in fn-22's suites (spec R10). The swap-count column keeps its name and key; the number is now the nodes added or removed, expected near zero.

**Size:** S/M
**Files:** `apps/bench/src/render-dom.bench.ts`, `apps/bench/src/scenarios.ts`, `apps/bench/baseline.json`, `apps/bench/README.md`
**Touches:** [apps/bench/src/**, apps/bench/baseline.json, apps/bench/README.md]

### Approach
- `scenarios.ts`: extend `sleekTree(jsx, first?)` with a `keyed` flag (add `key` per row); do not add a second tree builder. Add the keyed React counterpart (`h(Row, { key })` is already used).
- `render-dom.bench.ts`: add a keyed-list reorder case and a one-of-1000 update case in the existing `check(name, [[lib, body]])` + `describe` + `bench` pattern, each with a final-state correctness check across libraries.
- Run `bench:json`, review `compare` output (new cases are `NEW`, not failures), then refresh `baseline.json` deliberately (`update-baseline`) and note the run in the PR; update the README suite table row.
- `jsx-overhead` must still be within tolerance after the identity work (verified in the identity task; re-check here).

### Investigation targets
**Required**:
- `apps/bench/src/render-dom.bench.ts:19-94`, `apps/bench/src/scenarios.ts:31-39,320-329`
- `apps/bench/scripts/compare.ts:8-12`, `apps/bench/README.md`

### Acceptance
- [ ] The new cases run under `pnpm --filter bench bench:json` with passing correctness checks and report node-swap counts.
- [ ] `pnpm --filter bench compare` exits 0 against the refreshed baseline; `jsx-overhead` within tolerance.
- [ ] `pnpm test` still ignores `*.bench.ts`.

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
