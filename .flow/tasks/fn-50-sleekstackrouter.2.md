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
Added the @sleekstack/router package: a const route table (`routes`), path-string param inference (`Params`), `match` over percent-decoded segments, the `Route` service with `routeLayer`, and typed `params(table, name)`. Registered it in CI's script list and the AGENTS.md verify table, wrote the package README, and added a size-test check that ui has no router dependency.

baseline: none (new package; focused gate run post-edit green)
stage: impl-review - ran (codex fan-out NEEDS_WORK -> fixed decode/Params/empty-segment/__proto__ -> SHIP)
Tier: implementer opus at medium
## Evidence
- Commits: cdaae925eb2d4050d10788bcf8d1f47fa490ea3a, d308afbe2da14742addb0537d0c2fa4cd74eaf7a, fb503ce686c7df8a671be07adc4748a95f4b5dd6
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router..., npx vitest run test/size.test.ts (apps/ui-demo)
- PRs: