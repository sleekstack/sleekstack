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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
