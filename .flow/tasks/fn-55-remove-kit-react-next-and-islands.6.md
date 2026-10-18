---
satisfies: [R1, R7]
---
# fn-55-remove-kit-react-next-and-islands.6 delete kit, react, next and islands; clean workspace, CI and root README

## Description
Remove the four packages and every remaining reference outside docs prose: workspace config, CI package lists, the root README, leftover imports, the export-name test (ADR 0019), lockfile entries.

**Size:** M
**Files:** packages/kit/**, packages/react/**, packages/next/**, packages/islands/** (deleted); .github/workflows/ci.yml; root README.md; pnpm-workspace.yaml, pnpm-lock.yaml; any remaining import found by search
**Touches:** [packages/kit/**, packages/react/**, packages/next/**, packages/islands/**, .github/**, README.md, pnpm-workspace.yaml, pnpm-lock.yaml, turbo.json]

### Approach
- Precondition: the docs site must no longer import the removed packages (the docs-site rebuild spec lands first). Search `apps/docs` for the four names; if any remain outside prose, stop with `NEEDS_HUMAN` naming the files and do not delete anything.
  - fn-60 task 7 ran this search: `apps/docs` has no reference to the four names (positive control: the same grep over `packages` hits `packages/next`). Re-run it; it should still find nothing.
  - Second precondition: `packages/cli/src/initAgents.ts` and `packages/analyze/src/__tests__/llms.test.ts` read `packages/kit/llms.md` and break when kit is deleted. Task 5 moves that file; confirm `grep -rn "kit/llms\|../../../kit" packages` finds nothing before `git rm`.
- Search the whole repo for the four package names (positive control: confirm the search finds a hit before the removal) and clear what remains; delete the packages with `git rm`.
- CI: update the package lists and the `build:types` step that names kit; keep the bench and size gates.
- Equivalence pin: `packages/core` and `packages/runtime` test suites unchanged and passing; non-kit fixture graph output identical to task 4's saved output.
- Check `git diff pnpm-lock.yaml` for stray `apps/sleek-codes` entries.

### Investigation targets
**Required**:
- `.github/workflows/ci.yml` (package lists, `build:types`)
- `README.md` (package table, kit and React examples, Planned list)
- `packages/kit/src/__tests__/exportNames.test.ts` (goes with kit)
- `pnpm-workspace.yaml`, `turbo.json`
**Optional**:
- `packages/query/package.json`, `packages/testing/package.json` (stale workspace deps)

## Acceptance
- [ ] The four packages are gone; a repo-wide search for their names finds nothing outside ADR history and the new ADR
- [ ] From a clean checkout `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm typecheck` and `pnpm test` pass
- [ ] CI config lists only existing packages; core and runtime suites unchanged; fixture graph output identical for the remaining fixtures

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
