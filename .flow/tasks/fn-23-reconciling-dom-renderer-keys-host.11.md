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
Added render-dom/keyed-reorder-1k (rows 1 and 998 swapped) and render-dom/keyed-update-1-of-1k (row 500 relabelled via a whole-list re-render) with cross-library correctness checks and node-swap counts, and refreshed baseline.json after three consistent full runs (none NOISY).

Node swaps per update: update-1-of-1k 0/0, keyed-update-1-of-1k 0/0, keyed-reorder-1k 1994/1994 (sleekstack/react; both move the 997 rows between the swapped pair).
Ratios old baseline -> new baseline (runs 1/2/3 before refresh): render-string/list-1k 1.742 -> 2.406 (2.307/2.451; per-instance identity on the string path - maintainer to judge); jsx-overhead/non-reactive-1k 3.135 -> 3.318; jsx-overhead/one-reactive-1k 2.647 -> 3.131; render-dom/mount-1k 1.465 -> 1.596; render-dom/update-1-of-1k 0.460 -> 0.414; atoms/diamond 0.176 -> 0.223; atoms/batch-write 0.265 -> 0.307; subscribe-notify n=1000 0.349 -> 0.362; other atoms within +-0.02. New: keyed-reorder-1k 1.238, keyed-update-1-of-1k 4.274.
Caveat: the sleekstack keyed cases need one setTimeout(0) turn to commit (microtask settling is not enough for a whole-list re-render), so their time includes a timer turn; React uses flushSync. Keyed-update's 4.3x is partly that.
Drift: Row in scenarios.ts is now module-level (takes jsx/label props) so the component type is stable across re-renders; with the per-call Row the reconciler replaced all 1000 rows. This slightly changes render-string and jsx-overhead workloads.
swaps key and 'node swaps' column unchanged. pnpm --filter bench test runs only the 9 compare tests (bench files excluded).

stage: impl-review - skipped(config: REVIEW_MODE=none)
Tier: session (jev-unavailable(no_key)); routing block pins implementer opus at medium
## Evidence
- Commits: da8d021dc26a4f378cbfb43d3935f96b897c7a3b
- Tests: pnpm --filter bench bench:json && pnpm --filter bench compare, pnpm --filter bench test, pnpm --filter bench typecheck
- PRs: