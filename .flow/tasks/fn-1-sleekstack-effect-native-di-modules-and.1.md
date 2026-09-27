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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
