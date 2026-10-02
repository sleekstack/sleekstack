---
satisfies: [R2]
---
# fn-13-runtime-package-request-aware-graph.3 Show all roots on the showcase /graph page and in the devtools panel

Touches: apps/showcase/app/graph/**, apps/showcase/src/server/report.server.ts, packages/devtools/src/graph/**, packages/devtools/src/index.tsx

## Description
**Task 2 drift:** Report roots carry `kind` ('app'|'request'|'overrides'|'opaque'), app first; `--lenient` covers only runEffect request/overrides layers (an unresolvable configureRuntime layer still fails); errors for these roots sit at the runEffect call's file:line.

**Touches:** apps/showcase graph page, packages/devtools graph helpers (graphsOf in a separate file from the panel/tracing work)

**Files:** apps/showcase graph route, apps/showcase/src/server/report.server.ts (add root `kind` to the report type), packages/devtools graphsOf and the panel entry packages/devtools/src/index.tsx (shared with tasks 4/5, so this task runs after them)

The /graph page and `graphsOf` currently read `roots[0]` only. Render every root with its `kind`, drawing request/overrides roots with edges into the app graph. Keep ordering app-first. Unknown `kind` values render as a plain root, not an error (additive schema).

## Acceptance
- [ ] /graph lists RequestLive and DemoLive with their kind
- [ ] graphsOf unit test covers app + request + overrides + opaque roots
- [ ] showcase build and tests pass

## Done summary
/graph renders every analyzer root (app first, then request/overrides) with its kind; unknown kinds render as a plain root. `graphsOf` moved to packages/devtools/src/graph/graphsOf.ts, carries `kind`, and prefers kind-carrying sources (`runtimes`, then `roots`) over a bare `graphs` list; the panel shows `[kind]`.

Tests: packages/devtools/src/__tests__/graphsOf.test.ts (app + request + overrides + opaque + unknown kind; roots over bare graphs), apps/showcase/src/__tests__/graph.test.ts (RequestLive [request] and DemoLive [overrides] after the app root, from a fixture; unknown kind plain). The test does not read `.sleekstack/` (gitignored build output).

Notes: the branch moved during the task (user commit 3452587 useEffectTransition, merge 190a950 of origin/master, 03232f4 fixing this task's test import to delivery/). The review range 53bdcf9..HEAD therefore includes them; review findings on useEffectTransition were out of scope and not acted on (one draw flagged it breaks the no-new-react-sugar boundary and docs api-coverage needs an entry - the full gate was green here).

baseline: red (showcase-kit bundle.test.ts Islands, 2 tests, pre-existing) - green at Verify
Tier: implementer tier, project routing block (opus at medium)

stage: impl-review - ran (codex fan-out NEEDS_WORK x2 heads refunded on branch moves -> fan-out NEEDS_WORK -> re-review SHIP)
## Evidence
- Commits: e7aecd6bf6ab140aa43b4bd2615b249eb496c332, a5276aa87b589eb955350d8f611a3628fa4c6ebe, e3160f34c2c1a30d59168e2b0def148b10185a1f, 19826233a0e726525b4d977012d4e74801803af0
- Tests: pnpm typecheck && pnpm test, pnpm --filter showcase build && pnpm --filter showcase test
- PRs: