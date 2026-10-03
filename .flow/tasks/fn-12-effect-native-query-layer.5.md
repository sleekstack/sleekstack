---
satisfies: [R8]
---
# fn-12-effect-native-query-layer.5 React hooks: useQuery, useMutation, store placement, suspense opt-in, StrictMode

Touches: [packages/react/src/query.ts, packages/react/src/index.tsx, packages/react/src/context.ts, packages/react/src/__tests__/query.test.tsx, packages/react/package.json]

## Description
Hooks in `@sleekstack/react` next to the atom hooks (spec: Store placement, Suspense).

**Size:** M
**Files:** packages/react/src/query.ts, packages/react/src/index.tsx, packages/react/src/context.ts, packages/react/src/__tests__/query.test.tsx, packages/react/package.json
**Touches:** [packages/react/src/query.ts, packages/react/src/index.tsx, packages/react/src/context.ts, packages/react/src/__tests__/query.test.tsx, packages/react/package.json]

### Approach
- Resolve the query store to the nearest app-scoped store (root `LayerProvider` or an explicit `QueryProvider` marker), not the nearest component scope; `Queries` is bound to the same store. Mixed nesting test required.
- `useQuery` returns plain values and never suspends; `useQuerySuspense` suspends only on `Initial` and returns stale data plus the error when a `Failure` has a previous value; `useQueryResult` exposes `Result`. `useMutation` runs `onMutate` in the event handler.
- fn-12.4 drift: read the fetching-direction flag from `Query.isFetchingNext(store, atom)` / `Query.isFetchingPrevious(store, atom)` (not from `Result`); `fetchNext`/`fetchPrevious` are no-ops until the first page loads; `Query.select` keeps the previous Model on a failed refetch (Failure retains it). Mutation is `Mutation.make/shared/runner(store, mutation)/optimistic` exported from `@sleekstack/query`; `useMutation` wraps `Mutation.runner`. <!-- Updated by plan-sync: fn-12.3, fn-12.4 -->
- fn-12.3 known gap: a refetch landing while a mutation is in flight is overwritten by the next optimistic recompute (ponytail in mutation.ts); do not assert otherwise in hook tests.
- Follow the atom hook patterns (useSyncExternalStore, settleSuspensions); catch the PENDING sentinel on async paths (`.flow/memory/bug/runtime-errors/kit-atom-pending-sentinel-must-be-2026-09-28.md`).

### Investigation targets
**Required**:
- `packages/react/src/atoms.ts:14-162,257` — hooks, AtomsClientOnly, settleSuspensions, useAtomSuspense
- `packages/react/src/context.ts` — store per scope
- `packages/react/src/__tests__/renderStrict.tsx` — StrictMode helper

## Acceptance
- [ ] StrictMode double mount performs one fetch and one `onMutate`
- [ ] Nested providers share one query store; `invalidate` from a child reaches the parent's entries (test)
- [ ] Suspense only on `Initial`; background refetch never suspends; stale data plus error shown for Failure with previous value
- [ ] React package tests and typecheck pass

## Done summary
Added query hooks to @sleekstack/react (useQuery, useQuerySuspense, useQueryResult, useInfiniteQuery, useQueries, useMutation, QueryProvider) on an app-scoped query store: the root LayerProvider seeds QueryStoreContext through a wrapped ProviderContext.Provider in context.ts (LayerProvider untouched), and QueryProvider re-points it. A render never builds a missing query; observations hand off across StrictMode remounts (until next task) and Suspense retries (400 ms), so one fetch and one onMutate per StrictMode mount. Tests in packages/react/src/__tests__/query.test.tsx cover StrictMode, nested-provider invalidate, QueryProvider, suspense-only-on-Initial with stale data plus error, sync suspense, real-remount refetch, and defects to the boundary. pnpm-lock.yaml changed for the new @sleekstack/query workspace dependency.

Tier: implementer
stage: impl-review - ran (codex fan-out NEEDS_WORK, 3 findings fixed; re-review SHIP)
## Evidence
- Commits: 1d7ee8896bd3eb726eef2ef46a7d10a1a371af16, c19e57ec964d44a9b67ca6d7f9a9a35480360ece
- Tests: pnpm --filter @sleekstack/query test && pnpm --filter @sleekstack/react test && pnpm --filter @sleekstack/kit test, pnpm --filter @sleekstack/react typecheck, pnpm --filter showcase typecheck && pnpm --filter showcase test
- PRs: