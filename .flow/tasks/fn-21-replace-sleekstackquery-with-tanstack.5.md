---
satisfies: [R6]
---
# fn-21-replace-sleekstackquery-with-tanstack.5 devtools: queries panel reads the client's QueryCache

## Description
Port the devtools queries panel off the removed `QueryEvents` buffer (R6).

**Size:** S
**Files:** `packages/devtools/src/panel/queries.tsx`, `packages/devtools/package.json`, `packages/devtools/src/__tests__/` (the existing queries panel test)
**Touches:** [packages/devtools/src/panel/queries.tsx, packages/devtools/package.json, packages/devtools/src/__tests__/**, pnpm-lock.yaml]

### Approach
- Snapshot from `client.getQueryCache().getAll()`, live events from `getQueryCache().subscribe`; map TanStack events to the panel's existing row shape. Keep the production gating and the empty state when no client is in scope (`packages/devtools/src/panel/queries.tsx`, 54 lines).
- Get the client from `QueryClientTag` the way the panel already reaches other scope services; do not add a new global.
- Keep the `@sleekstack/query` dependency (the bridge now provides `QueryClientTag`); stop importing `QueryEvents`.

### Investigation targets
**Required**:
- `packages/devtools/src/panel/queries.tsx`, the devtools queries test, `packages/query/src/client.ts` (task 1)

### Key context
Parity only; no new panel features.

## Acceptance
- [ ] The panel lists queries and their events from the `QueryCache`, shows nothing in production, and shows the empty state with no client in scope (R6)
- [ ] `pnpm --filter @sleekstack/devtools test` and `typecheck` pass

## Done summary
Devtools queries panel now reads the scope client's TanStack QueryCache via useService(QueryClientTag): rows from getAll(), lifecycle events (added/fetching/success/failure/removed) from subscribe; nothing in production; empty state when no LayerProvider or no QueryClientTag; other errors rethrown. QueryEvents import dropped.

Follow-up: showcase DevtoolsMount sits in a sibling LayerProvider without QueryClientLive, so its panel shows the empty state until it is mounted under the app provider (showcase task).

stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review SHIP)
Tier: opus at medium
## Evidence
- Commits: 179b034b4e21cea1c8b435d0d2833350d3c33a3e, 278471e6db71cf478046d1e54fcf980ab5fe1919
- Tests: pnpm --filter @sleekstack/devtools test, pnpm --filter @sleekstack/devtools typecheck
- PRs: