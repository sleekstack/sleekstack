## Goal & Context
<!-- scope: business -->

SleekStack makes performance-relevant choices it has never measured: the host renderer replaces a reactive component's whole subtree on change (fn-19), the JSX runtime wraps every function-component call, and the native atoms (fn-7) are a from-scratch implementation. Nothing tells us whether a change makes them slower, and nothing lets us say how they compare to the tools people already know.

Add a benchmark suite with two jobs: (1) a regression guard that runs in CI and flags real slowdowns in `@sleekstack/ui` and the atoms in `@sleekstack/core`; (2) a published comparison against React (renderer) and jotai plus `@effect-atom/atom` (atoms), generated from the same suite so the numbers on the docs site are reproducible.

Scope is the UI renderer and atoms only. The DI runtime, query layer and analyzer are out of scope.

## Architecture & Data Models
<!-- scope: technical -->

- **One private workspace `apps/bench`** holds all benchmarks, so comparison libraries (`react`, `react-dom`, `jotai`, `@effect-atom/atom`, `jsdom`) are devDependencies of the bench app only and never of `@sleekstack/*` packages. Runner: `vitest bench` (vitest 4 is already the repo runner; it uses tinybench).
- **Suites** (one file each under `apps/bench/src/`):
  - `atoms.bench.ts`: create, read, write, derived-atom read after a dependency write, subscribe + notify with N=1/100/1000 subscribers, batched writes, and a diamond dependency graph; each case implemented for SleekStack, jotai and `@effect-atom/atom` against the same scenario definition.
  - `render-string.bench.ts`: `renderToString` of a fixed list tree (1k nodes) in SleekStack versus `react-dom/server` `renderToString` of the equivalent tree.
  - `render-dom.bench.ts` (jsdom): first `mount` of the same tree versus `createRoot().render` + `flushSync`; and a reactive update, where one atom changes and one subtree re-renders, versus a React `useState` update of the equivalent component. Reports node-swap count alongside time.
  - `jsx-overhead.bench.ts`: cost of the instance wrapper in `jsx()` for a non-reactive component tree versus calling the same components directly (the fn-19 claim that non-reactive components cost nothing).
- **Shared scenario definitions** live in `apps/bench/src/scenarios.ts` (sizes, tree shape, mutation sequence) so every library runs the identical workload; an adapter per library implements a small `Scenario` interface. The comparison is only as fair as this file, so each adapter states its idiomatic usage and links its docs in a comment.
- **Results.** `pnpm --filter bench bench:json` writes `apps/bench/results/latest.json` (vitest bench `--outputJson`): per case `{ name, library, hz, mean, p99, rme, samples }` plus machine info (Node version, CPU model, OS). `apps/bench/baseline.json` is the committed reference for the guard.
- **Regression guard.** `apps/bench/scripts/compare.ts` reads `latest.json` and `baseline.json` and compares **ratios, not absolute times**: for each SleekStack case, ratio = SleekStack mean / reference-library mean measured in the same run (jotai for atoms, React for rendering); for cases without a reference (the `jsx-overhead` and update-count cases) ratio = mean / the case's own direct-call baseline. A case regresses when its ratio exceeds the baseline ratio by more than the tolerance (default 50%, configurable per case). Ratios cancel most runner noise between CI machines; absolute numbers are never gated.
- **CI.** A separate job `bench` in `.github/workflows/ci.yml` runs on pull requests only: `pnpm --filter bench bench:json && pnpm --filter bench compare`. It is **required-failing on a regression above tolerance** and writes a markdown table to the job summary either way. It runs on `ubuntu-latest` with the same Node version as the build job; the main `Test` job never runs benchmarks, and `pnpm test` ignores `*.bench.ts`.
- **Published comparison.** `apps/docs` gets a page `benchmarks` generated at docs build time from `apps/bench/results/published.json` (a committed snapshot refreshed deliberately by `pnpm --filter bench publish-results`, not by CI), rendered as per-suite tables with the machine info and the library versions. The page states that results are one machine, one workload, and links the scenario file.
- **Packages touched:** new `apps/bench`; `apps/docs` (one page + generator); `.github/workflows/ci.yml`; root `package.json` scripts; CONTEXT.md (benchmark vocabulary only if a term is introduced).

## API Contracts
<!-- scope: technical -->

```ts
// apps/bench/src/scenarios.ts
interface AtomScenario { name: string; sizes: readonly number[]; adapters: Record<Library, (size: number) => () => void> }
type Library = 'sleekstack' | 'jotai' | 'effect-atom' | 'react'
```

- Scripts (`apps/bench/package.json`): `bench` (interactive vitest bench), `bench:json` (writes `results/latest.json`), `compare` (exit 1 on regression), `publish-results` (writes `results/published.json`).
- `compare` exit codes: 0 no regression, 1 regression, 2 missing or malformed input; output is a markdown table on stdout.
- The adapter returned function is the measured body; setup runs outside it. No benchmark may assert on result values inside the measured body.

## Edge Cases & Constraints
<!-- scope: technical -->

- Each adapter has a one-time correctness check (outside measurement) that the final state or DOM matches the other libraries', so a benchmark of a broken implementation fails instead of reporting a fast wrong number.
- Warm-up: vitest bench warm-up is kept on; renderer cases run after a forced `gc` only if `--expose-gc` is available, otherwise skipped (never a failure).
- jsdom timings are not browser timings; the docs page says so and the DOM suites report relative numbers only.
- A new or renamed case with no entry in `baseline.json` is reported as `NEW` and does not fail; a baseline case with no result is reported as `MISSING` and fails (a removed benchmark must be removed from the baseline deliberately).
- Baseline refresh is a deliberate commit of `baseline.json` (`pnpm --filter bench update-baseline`), reviewed like a snapshot; CI never writes it.
- A noisy case (relative margin of error above 20%) is reported as `NOISY` and excluded from the gate for that run, not failed.
- The comparison libraries' versions are pinned exactly in `apps/bench/package.json` so numbers move only when the suite or SleekStack changes.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `apps/bench` exists as a private workspace; `pnpm --filter bench bench` runs all four suites, and `@sleekstack/*` package manifests gain no new dependency. Errors: a failing correctness check aborts that suite with the library and case named.
- **R2:** The atom suite benchmarks create, read, write, derived read, subscribe/notify at three subscriber counts, batched write and the diamond graph for SleekStack, jotai and `@effect-atom/atom` on identical scenarios from `scenarios.ts`. Errors: an adapter that cannot express a scenario is listed as `n/a` for it, not omitted silently.
- **R3:** The render suites benchmark string render, first DOM mount and a reactive update, each against React on the same tree, and report node-swap count for the update case. Errors: none beyond R1.
- **R4:** The `jsx-overhead` suite measures the wrapper cost for a non-reactive tree against direct calls, so the fn-19 "non-reactive components cost nothing" claim has a number. Errors: none beyond R1.
- **R5:** `bench:json` writes `results/latest.json` with per-case `hz`, `mean`, `p99`, `rme`, `samples`, library versions and machine info. Errors: a vitest run with no cases produces exit code 2, not an empty file.
- **R6:** `compare` gates on ratios against `baseline.json` with the tolerance rules above and exits 0 / 1 / 2 as specified, printing `NEW`, `MISSING`, `NOISY` and `REGRESSED` markers. Errors: malformed JSON or schema mismatch exits 2 with the file named.
- **R7:** The `bench` CI job runs on pull requests only, fails on a regression, and posts the table in the job summary; the main `Test` job does not run benchmarks and `pnpm test` ignores `*.bench.ts`. Errors: a baseline from a different Node major is reported as a warning, not a failure.
- **R8:** `apps/docs` renders a `benchmarks` page from `published.json` (tables per suite, machine info, library versions, a caveats paragraph); `publish-results` is the only writer of that file. Errors: a missing `published.json` fails the docs build with a message naming the command that creates it.
- **R9:** A unit test for the compare script covers a regression, an improvement, `NEW`, `MISSING`, `NOISY` and malformed input using fixture JSON, and runs under `pnpm test`. Errors: none.
- **R10:** The initial `baseline.json` and `published.json` are committed from one recorded run, and the README of `apps/bench` documents how to refresh each and why ratios are gated, not times. Errors: none.

## Boundaries
<!-- scope: business -->

- No benchmarks for the DI runtime, query layer, analyzer, Next adapter or devtools.
- No browser-based benchmarking (Playwright); jsdom and Node only.
- No absolute-time gating and no cross-run trend storage or dashboard.
- No performance optimization work; findings from the numbers become their own specs.
- No benchmarking against frameworks beyond React, jotai and `@effect-atom/atom` in this spec.
- The CI job does not write to the repo or comment on the pull request beyond the job summary.

## Decision Context
<!-- scope: both -->

- **Ratios against a same-run reference, not absolute times**: shared CI runners vary by far more than the regressions worth catching; a SleekStack/jotai ratio measured in one process cancels most of that variance. Accepted cost: a regression that slows SleekStack and the reference equally is invisible.
- **Separate `apps/bench` workspace**: keeps jotai, `@effect-atom/atom` and React out of every package manifest and keeps `pnpm test` fast.
- **`vitest bench`**: already the repo's runner, JSON output built in, no new tool.
- **Published snapshot refreshed by hand**: a CI-written docs page would change on noise and make every PR dirty; a deliberate snapshot is a reviewed claim.
- **Required-failing on PRs**: a guard that only warns gets ignored; the 50% tolerance and `NOISY` exclusion are what keep it from crying wolf.
- **Rejected: hosted continuous benchmarking (trend dashboard)**: extra service and secrets for a private pre-1.0 repo; revisit if the repo goes public.
- **Rejected: benchmarking in a real browser now**: slower, flakier CI; jsdom keeps the render suites relative-only, and the docs say so.
