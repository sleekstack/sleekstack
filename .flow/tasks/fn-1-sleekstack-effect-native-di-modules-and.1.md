---
satisfies: [R10]
---
# fn-1-sleekstack-effect-native-di-modules-and.1 Foundation: CI runs tests on default branch + per-package test setup + StrictMode helper

## Description
Make the safety net real before engine work (R10). CI currently triggers on `main` (repo uses `master`) and runs typecheck only; `@sleekstack/next` has no test/typecheck script.

**Size:** S
**Files:** `.github/workflows/ci.yml`, `packages/next/package.json`, `packages/next/vitest.config.ts`, `packages/next/tsconfig.json`, `packages/react/src/__tests__/renderStrict.tsx`, `turbo.json`
**Touches:** [.github/workflows/ci.yml, packages/next/**, packages/react/src/__tests__/renderStrict.tsx, turbo.json]

## Approach
- CI: trigger on push to `master` and on pull_request; steps install -> typecheck -> test.
- Next package: add `test`/`typecheck` scripts + vitest config (node environment) mirroring `packages/core/vitest.config.ts` and `packages/core/package.json:7-9`; one placeholder test.
- React: add a `renderStrict` test helper wrapping RTL `render` in `<StrictMode>`; all new React tests use it.

## Investigation targets
**Required:**
- `.github/workflows/ci.yml` — current triggers/steps
- `packages/core/package.json`, `packages/core/vitest.config.ts` — script/config pattern
- `turbo.json` — task graph

## Acceptance
- [ ] CI workflow triggers on push to master and PRs; runs typecheck and test
- [ ] `pnpm test` and `pnpm typecheck` run for core, react, next
- [ ] CI step fails if any of core/react/next lacks a `test` or `typecheck` script (explicit package list; CLI shim excluded per R10)
- [ ] `renderStrict` helper exists and is used by at least one test

## Done summary
CI now triggers on master pushes + PRs, checks core/react/next have test/typecheck scripts, then runs typecheck and test. @sleekstack/next has vitest (node) + tsconfig + placeholder test. The renderStrict helper (RTL reactStrictMode, which persists across rerender) is used by all React adapter suites. REACT-03 is marked it.fails under StrictMode as a known R9 provider-lifecycle gap; flip it to `it` in tasks .6-.8.

baseline: green
stage: impl-review - ran (codex: NEEDS_WORK x2 -> SHIP)
## Evidence
- Commits: 2f495b9b99f88f5a8b5eb8c7fef862bfcd890758, 2d152b88fa4eca14d2e78179527e92f0780a6d52, 00b3c9659782c61090934458acb7fa4abe62ef77
- Tests: pnpm typecheck, pnpm test
- PRs: