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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
