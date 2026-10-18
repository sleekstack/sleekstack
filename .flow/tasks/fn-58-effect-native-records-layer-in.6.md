---
satisfies: [R6]
---
# fn-58-effect-native-records-layer-in.6 Optional query entry: queryOf(record) over the Query Client

## Description
The optional `@sleekstack/model/query` entry (with `queryOf`) that wraps `find` with caching, de-duping and stale handling from `@sleekstack/query`. It is a separate binding, so the base entry never imports `query`.

**Size:** M
**Files:** packages/model/src/query.ts, packages/model/package.json, packages/model/tsconfig.build.json, packages/model/src/__tests__/query.test.ts
**Touches:** packages/model/src/query.ts, packages/model/package.json, packages/model/tsconfig.build.json, packages/model/src/__tests__/query.test.ts

### Approach
- Flat `src/query.ts`, not re-exported from `src/index.ts`. Add the `./query` export and optional peers (`@sleekstack/query`, `@tanstack/query-core`), mirroring `packages/query/package.json`'s `./ui` entry. `tsc` emits it with no config change.
- The entry exports `queryOf(record)` returning the record's query binding; callers write `queryOf(Post).query(id)`. No registration at import time (`sideEffects: false`), and the base factory has no reference to `query`.
- `.query(id)` runs `find` through `effectFn` with a key `[type, id]`, and ingests on every read, including a hydrated cache hit (hydration sets cache entries without running the query function).
- Ordering: an ingest from the cache or a hydrated entry carries the entry's `dataUpdatedAt` and is dropped unless it is strictly newer than the slot's `ackedAt` (task 5); a tie is dropped, because the cache would otherwise replay a value the acknowledgement already superseded. After a commit the binding writes the acknowledged wire into the record's query entry. Read `ackedAt`; do not edit the registry.
- `effectFn` runs with the Query Client Layer's services: the Store and the adapter Layer must be provided to that Layer; document it and test the missing-Tag rejection.
- From task 5: `commit` sets the slot's `ackedAt` with `stamp()` (`packages/model/src/adapter.ts`) and writes the slot directly, not through `ingest()` (a save's own write must always land); it does NOT write the acknowledged wire into the query entry. This task's binding owns that: after a commit the record's query entry `[type, id]` must be updated with the acknowledged wire, so choose the smallest way for the binding to learn of an acknowledged save without the base entry importing `query` (for example an optional acknowledgement callback on the record that the binding registers through its own explicit call, never at import time).
- Read ADR 0025 (ui does not depend on query) before adding the peer; `query` must not import `model`.

- `queryOf(record)` also returns the fetch strategy that `useRecord(record, id, { via })` (task 4, base entry) accepts: it ensures the data through the Query Client service (`QueryClientTag`, `effectFn`, TanStack `ensureQueryData` or `fetchQuery` with key `[type, id]`), NOT through `useQuery`. The result states and the map-as-source-of-truth behaviour stay those of task 4's `useRecord`. Unmount interrupts the fetch through the query's abort signal.

## Investigation targets
**Required**:
- `packages/query/src/client.ts:44-80` - `effectFn` and its context map
- `packages/query/src/ui.ts:34,57,256` - registry and transfer
- `packages/query/package.json` - `./ui` entry and optional peers
- `docs/adr/0025-*.md`

## Acceptance
- [ ] `queryOf(Post).query(id)` caches, de-duplicates and ingests a fetch into the map
- [ ] A cache entry older than a committed save cannot overwrite the saved record, including a hydrated entry
- [ ] Deterministic test: the cache update and the save acknowledgement share the same timestamp T; reading the cache afterwards keeps the saved record
- [ ] `useRecord(Post, id, { via: queryOf(Post) })` returns the same result states as the default, fetching through the Query Client
- [ ] The `via` path never calls `useQuery`; a cancelled mount interrupts the fetch
- [ ] The base entry's bundle loads none of `query` (checked in task 7)
- [ ] A cache hit and a hydrated state fill the same record atoms
- [ ] Only `./query` needs `@sleekstack/query`; installing `model` without it works
- [ ] A missing Store or adapter Layer in the Query Client Layer is reported, not silent
- [ ] Tests: `packages/model/src/__tests__/query.test.ts`

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
