---
satisfies: [R1, R2, R5]
---
# fn-22-benchmark-suite-for-the-ui-renderer-and.1 bench: scaffold apps/bench, scenario model and atoms suite

## Description
Private workspace `apps/bench`: devDependencies `vitest`, `jotai`, `@effect-atom/atom` (exact versions), `react`, `react-dom`, `jsdom`, workspace `@sleekstack/core` and `@sleekstack/ui`. Scripts `bench`, `bench:json` (`vitest bench --run --outputJson results/latest.json`), `test`, `typecheck`.

**Size:** M
**Files:** `apps/bench/package.json`, `apps/bench/tsconfig.json`, `apps/bench/vitest.config.ts`, `apps/bench/src/scenarios.ts`, `apps/bench/src/atoms.bench.ts`, `pnpm-lock.yaml`

### Approach
- Define `Library`, `AtomScenario` and the machine/version metadata writer in `scenarios.ts`; scenarios: create, read, write, derived read after a dependency write, subscribe+notify at 1/100/1000 subscribers, batched write, diamond graph. One adapter per library; a scenario an adapter cannot express is listed `n/a`.
- Each adapter runs a one-time correctness check outside the measured body (final values equal across libraries) and aborts the suite naming library and case on mismatch.
- Append library versions and machine info (Node, CPU, OS) to `latest.json` after the run (small post-step script), and exit 2 on an empty result set.
- Regenerate the lockfile with `pnpm install --lockfile-only` and remove any unrelated importer it adds (an `apps/sleek-codes` importer has appeared before).

### Investigation targets
**Required**:
- `packages/core/src/atom/Atom.ts`, `packages/core/src/atom/AtomStore.ts` (API surface to adapt)
- `apps/ui-demo/package.json`, `apps/ui-demo/vitest.config.ts` (jsdom/vitest conventions)
- `.github/workflows/ci.yml`

### Key context
Spec `.flow/specs/fn-22-benchmark-suite-for-the-ui-renderer-and.md` is authoritative; its Architecture section defines the scenario model, result format and ratio gate.

## Acceptance
- [ ] `pnpm --filter bench bench` runs the atom suite for SleekStack, jotai and effect-atom on identical scenarios
- [ ] A deliberately wrong adapter fails the correctness check with library and case named
- [ ] `latest.json` contains hz, mean, p99, rme, samples, library versions and machine info; an empty run exits 2
- [ ] No `@sleekstack/*` manifest gains a dependency; `pnpm typecheck` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
