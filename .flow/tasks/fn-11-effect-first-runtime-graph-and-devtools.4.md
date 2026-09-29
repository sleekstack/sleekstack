---
satisfies: [R4]
---
# fn-11-effect-first-runtime-graph-and-devtools.4 next: runtime introspection and bounded event buffer (graph, scopes, errors)

## Description
Record scope open/close, acquire/release and errors in a bounded per-process buffer and expose it with the graph Report through a dev-only handler.

**Size:** M
**Files:** packages/next/src/devtools.ts (new, separate entry), packages/next/src/runtime.ts, packages/next/package.json (export), packages/next/src/__tests__/devtools.test.ts
**Touches:** [packages/next/src/devtools.ts, packages/next/src/runtime.ts, packages/next/package.json, packages/next/src/__tests__/devtools*]

### Approach
- Buffer bound 200, cleared on reconfigure, no-op when NODE_ENV is production.
- `runtime.graph()`/handler returns the analyzer Report shape (task 3); when no Report is available it returns scopes/errors only.
- Handler lives in its own entry so production server bundles do not include it.

## Acceptance
- [ ] Buffer never exceeds 200 events and clears on reconfigure
- [ ] Handler returns scopes/errors/graph JSON in dev, 404 in production
- [ ] Recording adds no work when disabled

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
