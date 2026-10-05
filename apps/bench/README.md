# bench

Benchmarks for the `@sleekstack/ui` renderer and the `@sleekstack/core` atoms, with React, jotai and `@effect-atom/atom` as references. Private workspace: the comparison libraries are dev dependencies here only and are pinned exactly.

| Suite | What it measures | Reference |
| --- | --- | --- |
| `src/atoms.bench.ts` | create, read, write, derived read, subscribe/notify (1/100/1000 subscribers), batched write, diamond graph | jotai |
| `src/render-string.bench.ts` | `renderToString` of a 1k-row list | React `react-dom/server` |
| `src/render-dom.bench.ts` | first mount (jsdom), one-row reactive update, keyed-list reorder (rows 1 and 998 swapped) and keyed one-of-1000 relabel with a render callback (`keyed-update-render-callback`: a fresh `label` function each row calls while rendering, so no row can skip; the worst case), the same with data rows (item objects, and with an inline `onPick` per row; both log component runs per update), each with its node-swap count (nodes added or removed per update) | React `createRoot` + `flushSync` |
| `src/jsx-overhead.bench.ts` | the component instance wrapper in `jsx()` against direct component calls | `direct` |

Every library runs the same workload from `src/scenarios.ts`. Each case runs once before measurement and fails the suite, naming library and case, if the libraries' final states differ.

## Commands

```sh
pnpm --filter bench bench            # interactive vitest bench
pnpm --filter bench bench:json       # writes results/latest.json (exit 2 when no case ran)
pnpm --filter bench compare          # ratio gate against baseline.json: exit 0 ok, 1 regression, 2 bad input
pnpm --filter bench update-baseline  # results/latest.json -> baseline.json
pnpm --filter bench publish-results  # results/latest.json -> results/published.json (docs page)
pnpm --filter bench test             # compare script unit tests
```

`bench:json` and `compare` run on every pull request in the `bench` CI job, which posts the table to the job summary.

## Refreshing the committed files

- **`baseline.json`**: after an intended performance change, run `bench:json` then `update-baseline` and commit the file. Review it like a snapshot. CI never writes it.
- **`results/published.json`**: run `bench:json` then `publish-results` on a quiet machine and commit it. The docs `benchmarks` page is generated from it. CI never writes it.

## Reading the keyed update cases

All three change one of 1,000 keyed rows per write and report component runs per update. `keyed-update-data` (rows take an item object) and `keyed-update-handler` (item plus an inline `on*` handler) are the cases a row can be skipped: 1 run per update. `keyed-update-render-callback` passes a fresh function that the row calls while rendering, so every row re-runs (1,000 runs): that is the cost of the component-run path itself and the control for it. See ADR 0020.

## Why ratios, not times

Shared CI runners vary far more than the regressions worth catching, so absolute times are never gated. Each SleekStack case is divided by its reference measured in the same process (jotai for atoms, React for rendering, `direct` for jsx-overhead), and that ratio is compared with the baseline's ratio. A case regresses when its ratio grows more than 50% (`DEFAULT_TOLERANCE`, per-case overrides in `TOLERANCE` in `scripts/compare.ts`). A case whose margin of error is above 20% is `NOISY` and skipped for that run. A new case is `NEW` and passes. A baseline case with no result is `MISSING` and fails: remove it from the baseline on purpose. A baseline recorded on another Node major gives a warning, not a failure.

The cost of ratios: a change that slows SleekStack and the reference equally goes unseen.

jsdom timings are not browser timings. Read the DOM suites relative to React only.
