---
satisfies: [R2, R3]
---
# fn-11-effect-first-runtime-graph-and-devtools.5 showcase: use @sleekstack/next runtime and restore /graph and /errors from the analyzer

## Description
Replace the hand-written runtime module with `@sleekstack/next`, and bring back the graph and errors pages rendered from the analyzer Report.

**Size:** M
**Files:** apps/showcase/src/server/runtime.server.ts, apps/showcase/instrumentation.ts (restore), apps/showcase/package.json, apps/showcase/next.config.ts, apps/showcase/app/graph/page.tsx, apps/showcase/app/errors/page.tsx, apps/showcase/app/layout.tsx, apps/showcase/README.md, apps/showcase/src/__tests__/*, apps/showcase/e2e/smoke.spec.ts
**Touches:** [apps/showcase/**]

### Approach
- `runApp` becomes a thin call to `runEffect({ request: RequestLive, overrides: demo ? DemoLive : undefined })`; keep the defect-report test.
- Copy the graph/errors page pattern from apps/showcase-kit/app/graph and errors (analyzer Report based, commit ce8c9d4); broken-layer cases live in fixtures for the errors page.
- Add `@sleekstack/next` back to package.json and transpilePackages.
- Restore nav links and smoke e2e entries.

## Acceptance
- [ ] No hand-written ManagedRuntime in showcase
- [ ] /graph and /errors render from the analyzer Report; smoke e2e covers them
- [ ] requests, board, bundle tests pass; `next build` succeeds

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
