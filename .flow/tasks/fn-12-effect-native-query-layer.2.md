---
satisfies: [R3]
---
# fn-12-effect-native-query-layer.2 Queries service: invalidate, refetch, setData, getData, cancel, reset

Touches: [packages/query/src/queries.ts, packages/query/src/query.ts, packages/query/src/__tests__/queries.test.ts]

## Description
The `QueryClient`-equivalent service over the registry from task 1 (spec: Invalidation and direct writes).

**Size:** M
**Files:** packages/query/src/queries.ts, packages/query/src/query.ts, packages/query/src/__tests__/queries.test.ts
**Touches:** [packages/query/src/queries.ts, packages/query/src/query.ts, packages/query/src/__tests__/queries.test.ts]

### Approach
- `Queries` is a Tag bound to the query store; matching by key prefix (over `entry.tuple`, not the canonical string or the map key) or predicate via the registry (`Query.entries(store)`), then `Query.trigger(store, entry.atom, true)` / `store.refresh` on each match. The registry is keyed by `entry.id` (definition + canonical key), so two definitions sharing a key are separate entries; never match on the map key. <!-- Updated by plan-sync: fn-12.1 registry keyed by definition:key id; registry lives in query.ts (no cache.ts) -->
- `setData(atom, value)` takes the query atom (the registry cannot build one from a key alone) and writes via `store.set`; note `AtomStore.set` pulls the node first, so on a not-yet-built key it RUNS THE FETCH before the write lands (then the write overrides it). To avoid a wasted/racing fetch, setData must cancel or tolerate that initial fetch. <!-- Updated by plan-sync: fn-12.1 AtomStore.set pulls node first --> `getData` returns `Option`; `cancel` interrupts the in-flight fetch and any pending retry; `reset` restores `Initial` and drops the registry entry.
- Invalidate refetches subscribed queries only and marks unsubscribed ones stale without fetching.

### Investigation targets
**Required**:
- `packages/query/src/query.ts` (task 1: registry, `entries`, `trigger`, `observe`, `QueryEntry`)
- `packages/core/src/atom/AtomStore.ts:300` — refresh

## Acceptance
- [ ] Invalidate by prefix and by predicate refetches only subscribed matches
- [ ] `setData` on a missing key creates the entry; `getData` on a missing key is `Option.none`
- [ ] `cancel` during a retry stops the schedule; `reset` restores `Initial`
- [ ] Tests cover each operation

## Done summary
Added the `Queries` service (packages/query/src/queries.ts, exported from the package index): invalidate/refetch/cancel/reset by query atom, key-tuple prefix or predicate; setData/updateData/getData by atom. A store-scoped build override in query.ts lets setData/cancel skip the fetch and reset rebuild as Initial. Tests in queries.test.ts cover each AC.

Deviation: packages/query/src/index.ts (outside Touches) gained one export line, required by review (P1: service unreachable from the package entry).
Follow-up: spec's `Queries.setData(todo, id, updater)` Effect-returning form for mutations is left to task 3.

Tier: implementer (actual model: claude-opus-5-5)
stage: impl-review - ran (codex fan-out NEEDS_WORK -> re-review SHIP)
## Evidence
- Commits: 5164753995e7cc1e9c651e98e1c1768675d987b2, 65b56912e08dfe8c6438f41d87deeac3c4b90ba4
- Tests: pnpm --filter @sleekstack/query test && pnpm --filter @sleekstack/react test && pnpm --filter @sleekstack/kit test, pnpm --filter showcase typecheck && pnpm --filter showcase test
- PRs: