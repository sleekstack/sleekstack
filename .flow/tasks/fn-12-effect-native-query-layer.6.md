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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
