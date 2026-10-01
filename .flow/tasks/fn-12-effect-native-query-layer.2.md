---
satisfies: [R3]
---
# fn-12-effect-native-query-layer.2 Queries service: invalidate, refetch, setData, getData, cancel, reset

Touches: [packages/query/src/queries.ts, packages/query/src/cache.ts, packages/query/src/__tests__/queries.test.ts]

## Description
The `QueryClient`-equivalent service over the registry from task 1 (spec: Invalidation and direct writes).

**Size:** M
**Files:** packages/query/src/queries.ts, packages/query/src/cache.ts, packages/query/src/__tests__/queries.test.ts
**Touches:** [packages/query/src/queries.ts, packages/query/src/cache.ts, packages/query/src/__tests__/queries.test.ts]

### Approach
- `Queries` is a Tag bound to the query store; matching by key prefix (over the tuple, not the canonical string) or predicate via the registry, then `store.refresh` on each match.
- `setData` writes through the atom's `setSelf` path, creating the entry if missing; `getData` returns `Option`; `cancel` interrupts the in-flight fetch and any pending retry; `reset` restores `Initial` and drops the registry entry.
- Invalidate refetches subscribed queries only and marks unsubscribed ones stale without fetching.

### Investigation targets
**Required**:
- `packages/query/src/cache.ts` (task 1)
- `packages/core/src/atom/AtomStore.ts:300` — refresh

## Acceptance
- [ ] Invalidate by prefix and by predicate refetches only subscribed matches
- [ ] `setData` on a missing key creates the entry; `getData` on a missing key is `Option.none`
- [ ] `cancel` during a retry stops the schedule; `reset` restores `Initial`
- [ ] Tests cover each operation

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
