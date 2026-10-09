---
satisfies: [R12]
---
# fn-44-sleekstacktesting.1 Package scaffold and wiring

## Description
Package scaffold and wiring. Contract and rationale are in the parent spec (R-IDs above).

**Size:** S
**Files:** packages/testing/package.json, tsconfig.json, tsconfig.build.json, vitest.config.ts, src/index.ts, .github/workflows/ci.yml, AGENTS.md
**Touches:** [packages/testing/**, .github/workflows/ci.yml, AGENTS.md]

### Approach
- Copy `packages/ui` build layout (type module, exports to dist, tsc build, vitest, ui and effect as peers; stays private per ADR 0022).
- Add the package to CI's hardcoded 'Require test/typecheck scripts' list and a verify-table row; `packages/*` already covers the workspace and turbo.

## Acceptance
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/testing` runs (R12)
- [ ] CI list and AGENTS.md row updated


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
