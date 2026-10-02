---
satisfies: [R5, R6]
---
# fn-12-effect-native-query-layer.4 Infinite queries and Effect-valued select (Models)

Touches: [packages/query/src/index.ts, packages/query/src/infinite.ts, packages/query/src/select.ts, packages/query/src/__tests__/infinite.test.ts, packages/query/src/__tests__/select.test.ts]

## Description
`Query.infinite` and `select` (spec: Infinite / paginated queries, Select / Models).

**Size:** M
**Files:** packages/query/src/infinite.ts, packages/query/src/select.ts, packages/query/src/__tests__/{infinite,select}.test.ts
**Touches:** [packages/query/src/index.ts, packages/query/src/infinite.ts, packages/query/src/select.ts, packages/query/src/__tests__/infinite.test.ts, packages/query/src/__tests__/select.test.ts]

### Approach
- Infinite: one atom value `{pages, pageParams}`; `fetchNext`/`fetchPrevious`, `maxPages` (dropping from the opposite end), sequential refetch from page one; a failing page keeps prior pages and reports the failure.
- Select: `(a) => Effect<B, never, R2>` run after fetch, memoised on (data reference, reading scope) because R2 comes from the reading scope; while a re-select is pending the previous Model stays with `waiting`; a select needing an unprovided service surfaces the scope error.
- `Model.fromDto` from apps/showcase/src/models/task.ts is the reference consumer.

<!-- Updated by plan-sync: fn-12.2 exports modules via packages/query/src/index.ts; add export lines there -->

### Investigation targets
**Required**:
- `packages/query/src/query.ts` (task 1)
- `apps/showcase/src/models/task.ts` — Effect fromDto with ProjectNames service

## Acceptance
- [ ] Next/previous pages, `maxPages` trimming and sequential refetch work; failing page N keeps pages 1..N-1 and reports the failure
- [ ] Select memoised per (data, scope); same data under two scopes can yield different Models
- [ ] Pending re-select keeps the previous Model with `waiting`; missing select service yields the scope error

## Done summary
Added `Query.infinite` (pages + pageParams in one atom, fetchNext/fetchPrevious, maxPages trimming, sequential refetch, failing page keeps prior pages as previousValue, isFetchingNext/isFetchingPrevious) and `Query.select` (Effect-valued, memoised per data reference and store, refetch failure kept as Failure with previous Model, scope error on missing service). Tests in packages/query/src/__tests__/{infinite,select}.test.ts cover each AC.

Note: query.ts gives fetch no node access, so infinite wraps the family atom's read in place (ponytail-marked); `Query` namespace is now re-exported via infinite.ts. Follow-up: a `fetch(args, previous)` hook in Query.make would remove the wrap.

Tier: implementer
stage: impl-review - ran (codex fan-out NEEDS_WORK -> NEEDS_WORK -> SHIP)
## Evidence
- Commits: c6135240edf556b7631c4a3dccf863ea9a0f3499, 1f2ffad81acfb22351c3d396c451caa5e1fe0b61, 54de4dd536a7f41190108ce1be9a885926a3fe37
- Tests: pnpm --filter @sleekstack/query test && pnpm --filter @sleekstack/react test && pnpm --filter @sleekstack/kit test, pnpm --filter showcase typecheck && pnpm --filter showcase test
- PRs: