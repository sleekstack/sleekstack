---
satisfies: [R1, R2, R3]
---
# fn-50-sleekstackrouter.2 Package, typed route table and route Layer

## Description
Package, typed route table and route Layer. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/router/** (new; copy packages/query layout: private, exports, tsc build, vitest, ui and core as optional peers), tests
**Touches:** [packages/router/**, AGENTS.md, .github/workflows/ci.yml]

### Approach
- Const table with template-literal param inference (no codegen; verify against the repo's TS version); matched route provided as a Layer via `<Provider layer>`/`Provide` (component.ts, jsx-runtime.ts); register the package in CI's list and the verify table.
- Add a router-absence check next to the query-bridge one in `apps/ui-demo/test/size.test.ts` so `@sleekstack/ui` keeps no dependency on it.

## Acceptance
- [ ] Package builds; ui has no dependency on it (R1)
- [ ] Params typed from the path string, wrong access fails type-check (R2)
- [ ] Matched route readable as a service in the page (R3)


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
