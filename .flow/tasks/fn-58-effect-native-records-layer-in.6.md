---
satisfies: [R6]
---
# fn-58-effect-native-records-layer-in.6 Optional query entry: record.query over the Query Client

## Description
The optional `@sleekstack/model/query` entry that wraps `find` with caching, de-duping and stale handling from `@sleekstack/query`.

**Size:** M
**Files:** packages/model/src/query.ts, packages/model/package.json, packages/model/tsconfig.build.json, packages/model/src/__tests__/query.test.ts
**Touches:** packages/model/package.json, packages/model/src/query.ts

### Approach
- Flat `src/query.ts`, not re-exported from `src/index.ts`. Add the `./query` export and optional peers (`@sleekstack/query`, `@tanstack/query-core`), mirroring `packages/query/package.json`'s `./ui` entry. `tsc` emits it with no config change.
- `record.query(id)` runs `find` through `effectFn` with a key `[type, id]`, and ingests on every read, including a hydrated cache hit (hydration sets cache entries without running the query function).
- `effectFn` runs with the Query Client Layer's services: the Store and the adapter Layer must be provided to that Layer; document it and test the missing-Tag rejection.
- Read ADR 0025 (ui does not depend on query) before adding the peer; `query` must not import `model`.

### Investigation targets
**Required**:
- `packages/query/src/client.ts:44-80` - `effectFn` and its context map
- `packages/query/src/ui.ts:34,57,256` - registry and transfer
- `packages/query/package.json` - `./ui` entry and optional peers
- `docs/adr/0025-*.md`

## Acceptance
- [ ] `record.query(id)` caches, de-duplicates and ingests a fetch into the map
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
