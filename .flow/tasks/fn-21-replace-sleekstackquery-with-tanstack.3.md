---
satisfies: [R4]
---
# fn-21-replace-sleekstackquery-with-tanstack.3 next: prefetchQueries returning dehydrated state

## Description
Server prefetch on the new engine (R4), replacing `prefetch` over the old `Hydrate` module.

**Size:** S
**Files:** `packages/next/src/query.ts`, `packages/next/src/index.ts` (exports), `packages/next/package.json`, a test beside the existing next tests
**Touches:** [packages/next/src/query.ts, packages/next/src/index.ts, packages/next/package.json, packages/next/src/__tests__/query.test.ts, pnpm-lock.yaml]

### Approach
- `prefetchQueries(optionsList, runOptions?)` runs through `runEffect` (`packages/next/src/runtime.ts`, as the current `prefetch` does at `packages/next/src/query.ts:29-33`): inside the request scope get the client from `QueryClientTag`, `await client.prefetchQuery(options)` for each, return `dehydrate(client)`. A failing prefetch does not throw (TanStack rule); its entry is simply absent.
- Delete the process-global server runner registration (`Hydrate.setServerRunner`, line 36) and the docs about lazy server reads: they belonged to the old suspense model.
- The client is provided by the runtime's Layer; document that the configured runtime must include `QueryClientLive`.

### Investigation targets
**Required**:
- `packages/next/src/query.ts`, `packages/next/src/runtime.ts`, `packages/next/src/index.ts`
- `packages/query/src/client.ts` (task 1)

### Key context
The dehydrated shape is TanStack's `DehydratedState`; consumers pass it to `HydrationBoundary`.

## Acceptance
- [ ] `prefetchQueries` returns dehydrated state containing the prefetched queries and disposes the request-scoped client (R4)
- [ ] A rejecting `queryFn` leaves its entry out and does not throw; a failure to build the request scope rejects like `runEffect`
- [ ] `pnpm --filter @sleekstack/next test` and `typecheck` pass

## Done summary
Replaced `prefetch` (old Hydrate engine + global server runner) with `prefetchQueries(queries, runOptions?)` in @sleekstack/next: runs through `runEffect`, prefetches with the scope's `QueryClientTag` client, returns TanStack `dehydrate(client)`; rejected queries are omitted. Docs recommend `request: QueryClientLive()` for a per-request client. Added `@tanstack/query-core` dep and query.test.ts (success/omission/disposal, scope-build failure).

Tier: opus at medium
stage: impl-review - ran (codex fan-out, SHIP)
## Evidence
- Commits: f2a3746a8948082bf381bbba5e4e5e03acf5e27f
- Tests: pnpm --filter @sleekstack/next test, pnpm --filter @sleekstack/next typecheck
- PRs: