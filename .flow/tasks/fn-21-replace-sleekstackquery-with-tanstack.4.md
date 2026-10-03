---
satisfies: [R5]
---
# fn-21-replace-sleekstackquery-with-tanstack.4 kit: re-express cachedQuery and mutation over the new pieces

## Description
Keep the Effect-free kit facade working on the new engine (R5).

**Size:** M
**Files:** `packages/kit/src/query.ts`, kit react hooks that wrap it (find with `git grep -n "cachedQuery" packages/kit/src`), `packages/kit/package.json`, `packages/kit/src/__tests__/query.test.tsx`
**Touches:** [packages/kit/src/query.ts, packages/kit/src/react/**, packages/kit/src/index.ts, packages/kit/package.json, packages/kit/src/__tests__/query.test.tsx, pnpm-lock.yaml]

### Approach
- Read `packages/kit/src/query.ts` (156 lines) and its tests first; keep each public name whose meaning survives (`cachedQuery`, `mutation`, the kit hooks), re-expressed as `queryOptions` with an `effectFn` body and TanStack mutation options; bodies still `yield* SomeTag` through the scope.
- Remove any name that cannot survive (e.g. anything built on the old `Hydrate` / `QueryEvents`), do not shim it; list removals in the commit message.
- Preserve error normalization (`packages/kit/src/errors.ts` `normalize`) for rejected `effectFn` failures.
- Port `query.test.tsx` to the new engine.

### Investigation targets
**Required**:
- `packages/kit/src/query.ts`, `packages/kit/src/errors.ts`, `packages/kit/src/__tests__/query.test.tsx`
- `packages/react/src/query.ts` (task 2 result), `packages/query/src/client.ts` (task 1)

### Key context
`fn-16` (kit SSR prefetch for the old layer) is obsolete; do not implement any of it.

## Acceptance
- [ ] A kit query body resolves Tags with `yield*` and its result renders through the kit hooks; the ported kit query tests pass (R5)
- [ ] A rejected body surfaces the normalized kit error as before
- [ ] Removed names are listed in the commit message; `pnpm --filter @sleekstack/kit test` and `typecheck` pass

## Done summary
Kit `cachedQuery` / `mutation` now lower to TanStack query options and a mutationFn over `effectFn`; kit `useQuery` / `useMutation` / `useQueryClient` run on react-query against the scope's `QueryClientTag`. A root kit `LayerProvider` adds a component-lifetime `QueryClientLive`, and `QueryProvider` gives a subtree its own client. Removed (old Hydrate engine): `HydrateQueries`, kit/next `prefetch` + `PrefetchOptions`, `Dehydrated`, `QueryCodec`, `serializable`, mutation `concurrency`; keys hash via TanStack (no `InvalidQueryKey` pre-check). Under StrictMode the remount aborts and refetches (TanStack semantics; the test counts were updated to match).

Touches deviation: deleted packages/kit/src/next/prefetch.ts and src/__tests__/hydrate.test.tsx and edited next/index.ts (forced by removing the Hydrate-based names). Follow-ups: apps/showcase-kit still uses prefetch/HydrateQueries/serializable, and the reviewer says no fn-21 task owns that migration (task 9 excludes showcase-kit). errors.ts still lists the codes QueryDecodeFailed, NoServerRunner and InvalidQueryKey, which nothing uses now.

stage: impl-review - ran (codex: fan-out NEEDS_WORK x2, re-review SHIP)
## Evidence
- Commits: f17f83dda495583deef974be1fc546110da9fc24, bb307dbc007647b94edbd59baeac0816d10ce182, 042211bd1f42aa7eb54aa4412678c85fa4985c1f
- Tests: pnpm --filter @sleekstack/kit test, pnpm --filter @sleekstack/kit typecheck
- PRs: