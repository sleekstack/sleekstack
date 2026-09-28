---
satisfies: [R1, R2, R3]
---
# fn-4-bump-pnpm-to-11-and-move-overrides.1 Bump packageManager to pnpm 11, move overrides, update docs

## Description
Bump pnpm to 11 and move the pnpm settings into pnpm-workspace.yaml in one change, then refresh the lockfile and docs. Start from master after fn-3 merges.

**Size:** S
**Files:** package.json, pnpm-workspace.yaml, pnpm-lock.yaml, README.md, apps/*/README.md, packages/*/README.md, .github/workflows/ci.yml (only if needed)
**Touches:** [package.json, pnpm-workspace.yaml, pnpm-lock.yaml, README.md, apps/*/README.md, packages/*/README.md, .github/workflows/ci.yml]

### Approach
- Set `packageManager` to the current pnpm 11 release (match the local global, 11.1.3 or newer).
- Move `pnpm.overrides` (and any other `pnpm.*` keys) to `pnpm-workspace.yaml`; add `onlyBuiltDependencies` there if the install warns about build scripts (esbuild, sharp).
- `pnpm install`, then check that the lockfile's `overrides:` block and the resolved postcss/sharp/nanoid/baseline-browser-mapping versions stay patched.
- grep the docs for `pnpm@`, `pnpm 10` and `corepack` and update them.

## Acceptance
- [ ] TBD

## Done summary
Pinned pnpm@11.1.3, moved overrides (unchanged ranges) to pnpm-workspace.yaml, removed package.json pnpm field; lockfile unchanged (postcss 8.5.28, sharp 0.35.5, nanoid 3.3.19), frozen install green with no "no longer read" warning. Added minimumReleaseAgeExclude for sharp/@img/* because pnpm 11's default 1-day minimumReleaseAge rejects sharp 0.35.5 (published 2026-09-27) — follow-up: drop it once aged. No build-script warning, so no onlyBuiltDependencies. Install steps in playground/showcase/cli READMEs note pnpm 11; root README has no install step. R2 (CI) verified locally only.

stage: impl-review - ran [codex: NEEDS_WORK -> SHIP]
## Evidence
- Commits: c62f1c242e4dd5e86fe985f891bbb1ef7d640cd9, 72d1e57db226f246d10e35baf29865a092c95fa3
- Tests: CI=true pnpm install --frozen-lockfile, grep -A5 '^overrides:' pnpm-lock.yaml, pnpm typecheck && pnpm test
- PRs: