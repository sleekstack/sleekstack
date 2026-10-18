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
Added the optional `@sleekstack/model/query` entry (packages/model/src/query.ts, not re-exported from index). `queryOf(record)` returns `{ query(id), fetch }`, so `queryOf(Post).query(id)` and `useRecord(Post, id, { via: queryOf(Post) })` both work. The Query Client's `client.query` handles the key `[type, id]`, which gives caching, de-duping and stale handling by `staleTime`.

The query function runs find's steps in its own fiber through `effectFn`: `stamp()`, the adapter's `find`, decode, an id check, and `ingest`. The cache holds the wire. It runs with the Query Client Layer's services, so the Store and the adapter Layer must be provided to that Layer. A missing Tag is a defect naming it.

Every read ingests, including a cache hit or a hydrated entry, dated by the entry's `dataUpdatedAt`. A read is dropped unless it is strictly newer than the slot's `ackedAt`, so a tie is dropped. An entry holding another id is a `ParseError`. An evicted slot whose entry is no newer than its last ack refetches.

From task 5: after a read, the binding subscribes to the slot, keyed by type and id. Each new ack then writes the acknowledged wire into the entry with `updatedAt = ackedAt`. `commit.ts` and `record.ts` are unchanged. The last interrupted waiter cancels the query, and the abort signal interrupts the adapter call. The query never creates an observer (no `useQuery`).

Tests: packages/model/src/__tests__/query.test.ts covers these cases, each checked red against the code before its fix:
- cache, de-dupe and ingest
- hydrated fill
- an older hydrated entry against a save
- the same-T tie
- the ack written into the entry, with a second type sharing the id
- evict then refetch
- a wrong id
- a missing Store or adapter in the Layer
- `via` result states and a typed failure
- unmount cancel interrupting the adapter, twice
- the `./query` export

Deviations:
- packages/model/src/__tests__/adapter.test.ts is outside Touches. Its "package.json never mentions @sleekstack/query" assertion became: not in `dependencies`, and an optional peer. The task adds that optional peer.
- pnpm-lock.yaml changed with the new devDependencies.
- tsconfig.build.json needed no change.

New public names for task 7: `queryOf`, `RecordQuery` (entry `./query`). Task 7 should bundle-check that index.ts loads no query code.

stage: impl-review - ran (codex gpt-6.1-sol fan-out NEEDS_WORK: follow keyed by id only, waiter double-decrement, cancel not reaching the adapter, evicted slot not refilled, wrong-id ingest; fixed; re-review SHIP)
Baseline: green via handoff (verified at bc1dd39 by task 5; only .flow/ changed since). Post-edit gate green.
Tier: explicit routing from project CLAUDE.md (implementer: opus at medium)
## Evidence
- Commits: 50400c6187756c9ee8803b5736fc47fd5ed1a226, 6f5dd339777154dfcef62c990aff337dc947875c
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze
- PRs: