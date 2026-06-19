---
phase: 01-core-runtime
plan: "01"
subsystem: test-infrastructure
tags: [vitest, testing, tsconfig, vite, RED-phase, wave-0]
dependency_graph:
  requires: []
  provides: [test-runner-core, test-runner-react, playground-vite-config, nyquist-RED-tests]
  affects: [packages/core, packages/react, apps/playground]
tech_stack:
  added: [vitest@4.1.9, "@testing-library/react@16.3.2", jsdom@29.1.1, vite@8.0.16, "@vitejs/plugin-react@6.0.2"]
  patterns: [vitest-workspace-per-package, jsdom-test-environment, tsconfig-extends-base, nyquist-RED-tests]
key_files:
  created:
    - packages/core/tsconfig.json
    - packages/core/vitest.config.ts
    - packages/core/src/__tests__/module.test.ts
    - packages/core/src/__tests__/cycle.test.ts
    - packages/react/tsconfig.json
    - packages/react/vitest.config.ts
    - packages/react/src/__tests__/LayerProvider.test.tsx
    - packages/react/src/__tests__/useService.test.tsx
    - packages/react/src/__tests__/nesting.test.tsx
    - apps/playground/vite.config.ts
  modified:
    - packages/core/package.json
    - packages/react/package.json
    - apps/playground/package.json
    - pnpm-lock.yaml
decisions:
  - "React test files import from ../index (current prototype barrel) not ../LayerProvider/useService (not yet created) so tests run and fail at assertion level rather than import-resolution level — cleaner RED state"
  - "REACT-07 tests verify negative constraints (no Runtime/Scope/Fiber exported) which pass in both old and new implementations — this is correct; they assert an invariant that must hold"
  - "REACT-06 first test passes with old prototype (message contains LayerProvider) — second test requiring service name in message fails, ensuring at least one REACT-06 test is RED"
metrics:
  duration: "6 minutes"
  completed_date: "2026-06-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 10
  files_modified: 4
status: complete
---

# Phase 01 Plan 01: Test Infrastructure + Nyquist RED Summary

Established the Wave 0 test and build infrastructure for `@sleekstack/core`, `@sleekstack/react`, and `apps/playground`. Created the five failing test scaffold files (Nyquist RED) that cover all 12 Phase 1 requirements — vitest runs in both packages and reports failures.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Configure core + react package builds, tsconfigs, and vitest runners | 983ca0f | 9 files created/modified |
| 2 | Create failing test scaffolds for all 12 requirements (Nyquist RED) | 94e3939 | 5 test files created |

## What Was Built

### Task 1: Build Infrastructure

**`packages/core`:**
- `tsconfig.json` — extends `../../tsconfig.base.json`, outDir `./dist`, rootDir `./src`
- `vitest.config.ts` — `environment: 'node'`
- `package.json` — added `scripts.test: "vitest run"`, `scripts.typecheck: "tsc --noEmit"`, `devDependencies.vitest: "^4.1.9"`

**`packages/react`:**
- `tsconfig.json` — extends `../../tsconfig.base.json` with `jsx: "react-jsx"`
- `vitest.config.ts` — `environment: 'jsdom'`
- `package.json` — added test/typecheck scripts, `vitest`, `@testing-library/react`, `jsdom`, `react`, `react-dom`, `@types/react`, `@types/react-dom` devDependencies

**`apps/playground`:**
- `vite.config.ts` — `defineConfig` with `@vitejs/plugin-react` plugin
- `package.json` — added `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom` devDependencies; `react`, `react-dom`, `@sleekstack/core`, `@sleekstack/react`, `effect` dependencies

**`pnpm install`** resolved all new dependencies (96 added packages).

### Task 2: Failing Test Scaffolds (Nyquist RED)

Five test files created, all failing:

| File | Requirements Covered | Test Count |
|------|---------------------|------------|
| `packages/core/src/__tests__/module.test.ts` | CORE-01, CORE-04 | 8 tests |
| `packages/core/src/__tests__/cycle.test.ts` | CORE-02 | 5 tests |
| `packages/react/src/__tests__/LayerProvider.test.tsx` | REACT-01, REACT-04, REACT-08 | 5 tests |
| `packages/react/src/__tests__/useService.test.tsx` | REACT-03, REACT-06, REACT-07 | 7 tests |
| `packages/react/src/__tests__/nesting.test.tsx` | REACT-02, REACT-05, CORE-03 | 7 tests |

**vitest results:**
- `packages/core`: 2 test files failed, 13 tests failed (0 passed)
- `packages/react`: 3 test files failed, 13 tests failed, 6 passed

The 6 passing react tests cover REACT-06 (first test — message contains "LayerProvider", a constraint the old prototype satisfies) and REACT-07 (4 tests — negative constraints about Runtime/Scope/Fiber not being exported, which both old and new implementations satisfy). At least one failing test exists for every requirement.

## Requirement Coverage

```
CORE-01  — module.test.ts (8 failing tests)
CORE-02  — cycle.test.ts (5 failing tests)
CORE-03  — nesting.test.tsx (2 failing tests)
CORE-04  — module.test.ts (3 failing tests)
REACT-01 — LayerProvider.test.tsx (2 failing tests)
REACT-02 — nesting.test.tsx (2 failing tests)
REACT-03 — useService.test.tsx (1 failing test)
REACT-04 — LayerProvider.test.tsx (2 failing tests)
REACT-05 — nesting.test.tsx (2 failing tests)
REACT-06 — useService.test.tsx (1 failing test — service name in message)
REACT-07 — useService.test.tsx (1 failing test — EffectLib/createService not in exports)
REACT-08 — LayerProvider.test.tsx (1 failing test)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React test imports adjusted from non-existent files to `../index`**
- **Found during:** Task 2
- **Issue:** Tests importing `../LayerProvider` and `../useService` caused file-level import failures with `no tests` output instead of per-test failures. Plan explicitly allowed this but "no tests found" silence is excluded by acceptance criteria.
- **Fix:** Changed imports to use `../index` (current prototype barrel) so tests run and fail at assertion level.
- **Files modified:** All 3 react test files
- **Commit:** 94e3939 (included in original task commit)

**2. [Rule 2 - Enhancement] Strengthened REACT-01, REACT-06, REACT-07 tests to ensure RED state**
- **Found during:** Task 2
- **Issue:** Original REACT-01 test only checked children render (coincidentally passes with old prototype). REACT-06 first test checked for "LayerProvider" in error message (old prototype satisfies). REACT-07 tests were all negative constraints that pass with old implementation.
- **Fix:** REACT-01 tests now require service resolution via `provide` prop (old prototype ignores `provide`). REACT-06 added second test requiring service name in error message. REACT-07 added test requiring NO `EffectLib`/`createService` in exports (old prototype has these).
- **Files modified:** `packages/react/src/__tests__/LayerProvider.test.tsx`, `packages/react/src/__tests__/useService.test.tsx`
- **Commit:** 94e3939

## Known Stubs

None — this plan creates test infrastructure only. No production code was written. The tests are intentionally failing (RED state).

## Self-Check: PASSED

All 10 created files found on disk. Both task commits (983ca0f, 94e3939) verified in git log.
