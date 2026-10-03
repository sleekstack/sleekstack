---
satisfies: [R7]
---
# fn-12-effect-native-query-layer.6 SSR: prefetch, dehydrate and HydrateQueries

Touches: [packages/query/src/index.ts, packages/query/src/hydrate.ts, packages/next/src/query.ts, packages/next/src/index.ts, packages/react/src/HydrateQueries.tsx, packages/react/src/query.ts, packages/query/src/__tests__/hydrate.test.ts]

## Description
Server prefetch through the Next runtime and client hydration of the query store (spec: SSR prefetch and hydration; biggest unknown).

**Size:** M
**Files:** packages/query/src/hydrate.ts, packages/next/src/query.ts, packages/next/src/index.ts, packages/react/src/HydrateQueries.tsx, packages/react/src/query.ts, tests
**Touches:** [packages/query/src/index.ts, packages/query/src/hydrate.ts, packages/next/src/query.ts, packages/next/src/index.ts, packages/react/src/HydrateQueries.tsx, packages/react/src/query.ts, packages/query/src/__tests__/hydrate.test.ts]

### Approach
- `prefetch(queries)` runs the query Effects via `runEffect` (packages/next/src/runtime.ts) and returns `Dehydrated`; values encoded with a required `Schema`; failures opt-in.
- `<HydrateQueries>` seeds the app-scoped query store through the atom write path (`store.set`; it pulls the node first, so seeding an unbuilt key starts a fetch unless the seeding avoids it - verify/handle; fn-12.1 drift); hydrating into a mounted key keeps the newer `updatedAt`; a value failing its Schema is dropped and refetched; hydrated entries are fresh until `staleTime`.
- Server hooks take a separate branch reading the dehydrated map from context (no store, so no `AtomsClientOnly`); an un-prefetched key on the server suspends on a fetch started through `runEffect`.
- fn-12.5 drift: `packages/react/src/query.ts` already exists (useQuery, useQuerySuspense, useQueryResult, useInfiniteQuery, useQueries, useMutation, QueryProvider) and is client only: its `useQueryStore` throws `AtomsClientOnly` when `typeof window === 'undefined'`, so the server branch is an addition to those hooks, not a new file. The store is `QueryStoreContext` (packages/react/src/context.ts; seeded at the root by the wrapped `ProviderContext.Provider`, re-pointed by `QueryProvider`); `<HydrateQueries>` should resolve it via `useQueries()` (the `Queries` client, `setData`) rather than reaching for the store directly. Suspense hooks hand off observations for 400 ms, so hydration seeding must not rely on a released subscription keeping a key alive. <!-- Updated by plan-sync: fn-12.5 -->
- Lessons: island server branch must nest the same provider context (`.flow/memory/bug/runtime-errors/island-server-branch-needs-the-same-2026-09-29.md`).

- fn-12.2 drift: hydration seeding should use `Queries.setData(atom, value)` semantics (value-only, cancels an in-flight fetch, creates a missing key without fetching); check it before hand-rolling `store.set`. Export hydrate from packages/query/src/index.ts. <!-- Updated by plan-sync: fn-12.2 -->

### Investigation targets
**Required**:
- `packages/next/src/runtime.ts:244` — runEffect
- `packages/react/src/atoms.ts:14-18` — AtomsClientOnly
- `packages/islands/src/Island.tsx` — server/client provider nesting

## Acceptance
- [ ] Server-rendered HTML contains prefetched data; client mounts without refetch until stale
- [ ] Mounted key keeps the newer `updatedAt`; Schema failure drops the entry and refetches; failed prefetch is not dehydrated by default
- [ ] Un-prefetched key on the server suspends and resolves; nested providers hydrate one store

## Done summary
Added SSR for query atoms: Hydrate (hydratable codec, prefetch, dehydrate, hydrate, apply, hydratedFailure) in @sleekstack/query, `prefetch` in @sleekstack/next via runEffect (registers the lazy server runner), `<HydrateQueries>` plus a server branch in the query hooks of @sleekstack/react. The server branch reads the provider's dehydrated map, suspends on un-prefetched keys, rethrows runner rejections, and sends lazily fetched entries to the client in a useId-keyed JSON script. Tests: packages/query/src/__tests__/hydrate.test.ts, packages/react/src/__tests__/hydrate.test.tsx.

Deviations from Touches: packages/react/src/index.tsx (export), packages/next/package.json + pnpm-lock.yaml (@sleekstack/query dep), packages/react/src/__tests__/hydrate.test.tsx.

Tier: implementer
stage: impl-review - accepted-by-user(NEEDS_WORK after 4 rounds; one finding left: the lazy server runner has no request/overrides Layers. The user accepted the contract: queries that need request-scoped services must be prefetched; lazy server reads use only the configured runtime)
## Evidence
- Commits: 87aecd0a22d1119f6e49bcc86d3033083fc0cb3b, 2466aac492532f77a34047fd70b20aa00aed4980, 79d451c47835f83a2c8721726e5d4b316f52d3b6, 1efe33518801491ee03a635f2df185fc8e5d4071
- Tests: pnpm --filter @sleekstack/query test && pnpm --filter @sleekstack/react test && pnpm --filter @sleekstack/kit test, pnpm --filter showcase typecheck && pnpm --filter showcase test, pnpm --filter @sleekstack/next test
- PRs: