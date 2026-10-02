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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
