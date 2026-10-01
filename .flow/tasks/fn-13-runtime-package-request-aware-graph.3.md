---
satisfies: [R2]
---
# fn-13-runtime-package-request-aware-graph.3 Show all roots on the showcase /graph page and in the devtools panel

Touches: apps/showcase/app/graph/**, apps/showcase/src/server/report.server.ts, packages/devtools/src/graph/**, packages/devtools/src/index.tsx

## Description
**Touches:** apps/showcase graph page, packages/devtools graph helpers (graphsOf in a separate file from the panel/tracing work)

**Files:** apps/showcase graph route, apps/showcase/src/server/report.server.ts (add root `kind` to the report type), packages/devtools graphsOf and the panel entry packages/devtools/src/index.tsx (shared with tasks 4/5, so this task runs after them)

The /graph page and `graphsOf` currently read `roots[0]` only. Render every root with its `kind`, drawing request/overrides roots with edges into the app graph. Keep ordering app-first. Unknown `kind` values render as a plain root, not an error (additive schema).

## Acceptance
- [ ] /graph lists RequestLive and DemoLive with their kind
- [ ] graphsOf unit test covers app + request + overrides + opaque roots
- [ ] showcase build and tests pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
