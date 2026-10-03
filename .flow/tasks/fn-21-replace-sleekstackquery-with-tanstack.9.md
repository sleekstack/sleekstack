---
satisfies: [R11]
---
# fn-21-replace-sleekstackquery-with-tanstack.9 showcase: migrate the board query layer to TanStack

## Description
Move the showcase onto the new engine (R11, showcase part): the board query, optimistic mutation, provider and hydration.

**Size:** M
**Files:** `apps/showcase/src/client/services/board-query.ts`, `apps/showcase/src/client/services/useBoardMutation.ts`, `apps/showcase/app/providers.tsx`, `apps/showcase/app/page.tsx` or wherever prefetch happens, `apps/showcase/package.json`, showcase tests (`apps/showcase/src/__tests__/board.test.tsx`, `apps/showcase/src/client/**` tests)
**Touches:** [apps/showcase/src/client/services/**, apps/showcase/app/**, apps/showcase/package.json, apps/showcase/src/__tests__/**, pnpm-lock.yaml]

### Approach
- Rewrite `board-query.ts` (87 lines) with `queryOptions` + `effectFn` and TanStack mutations: optimistic update in `onMutate`, rollback in `onError`, invalidate on settle; keep the DTO Schema (`BoardDto`) as the typed boundary.
- `providers.tsx` uses `QueryProvider`; server prefetch uses `prefetchQueries` and `HydrationBoundary`.
- Keep the showcase tests' intent: optimistic create with rollback, refetch on success, optimistic move (`board.test.tsx`); tests must not read the build-generated `.sleekstack` report (`.flow/memory/bug/test-failures/showcase-tests-must-not-read-the-build-2026-10-02.md`).
- Run the e2e smoke locally if the environment allows; CI runs it otherwise.

### Investigation targets
**Required**:
- `apps/showcase/src/client/services/board-query.ts`, `useBoardMutation.ts`, `apps/showcase/app/providers.tsx`, `apps/showcase/src/__tests__/board.test.tsx`
- react/next/kit results (tasks 2-4)

### Key context
The showcase also runs under `apps/showcase-kit` style checks in CI e2e; do not touch showcase-kit here.

## Acceptance
- [ ] Showcase typechecks and its unit tests pass on the new layer: optimistic create rolls back on failure, refetches on success, optimistic move works
- [ ] SSR hydration of the board works through `prefetchQueries` and `HydrationBoundary`
- [ ] The showcase imports only the bridge from `@sleekstack/query` (no `Query` / `Hydrate` / `Mutation` / `Queries`)

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
