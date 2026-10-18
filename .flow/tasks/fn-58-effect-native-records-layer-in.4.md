---
satisfies: [R4]
---
# fn-58-effect-native-records-layer-in.4 Adapter on the record: find, de-dupe, stale-write guard, scope ownership

## Description
The adapter Tag on the record and `find`. The adapter owns the wire contract (envelope, request body, PATCH shape); the record owns fields and transformations.

**Size:** M
**Files:** packages/model/src/adapter.ts, packages/model/src/record.ts, packages/model/src/index.ts, packages/model/src/__tests__/adapter.test.ts
**Touches:** packages/analyze/src/components.ts, packages/analyze/src/__tests__/slotHooks.test.ts, packages/analyze/src/__tests__/fixtures/ui-slots/**, packages/model/src/adapter.ts, packages/model/src/record.ts, packages/model/src/index.ts, packages/model/src/__tests__/adapter.test.ts

### Approach
- `defineRecord(type, { fields, adapter })` takes an app-declared `Effect.Tag` of `{ find, save }` (typed Effects). The package defines the adapter shape, not the Tags. A record with no adapter has only `push`, `atom`, `related`.
- `find(id)` = `adapter.find`, then hydrate, then `push`. In-flight calls for one id are de-duplicated per Store; a failed call is not reused.
- Each ingest carries a per-record counter taken at request start; a response older than the last acknowledgement is dropped.
- `find` runs under the Store's scope: disposing the scope interrupts it and writes nothing (memory: fibers forked outside atom builds must be owned by a registry and stopped on dispose).
- Tests swap the adapter with `mockLayer` from `packages/testing/src/mockLayer.ts` and with `Layer.succeed`. Two adapter Layers with different envelopes must serve one record unchanged.
- A missing adapter Layer shows in `R`; Tags match by declaration identity in the analyzer (memory), so do not generate Tags inside `defineRecord`.

- `useRecord(record, id, options?)`: a slot hook in the base entry. It reads `record.atom(id)` (the map is the source of truth) and runs `find` once when the slot is empty, through an Effect atom held by the Store (an atom of an Effect yields a `Result`), keyed by record and id. It returns a `Result`: waiting on first load, success with the map's value (kept during a refetch), typed failure when the slot is empty and the fetch failed; an empty slot after a successful fetch is a defect. `options.via` accepts a fetch strategy (type exported from the base entry, no `query` import; the default is the record's own `find`). Task 6 supplies the Query Client strategy.
- `useRecord` takes a slot, so add its line next to `model/draft#useDraft` in `packages/analyze/src/components.ts` and a conditional-call fixture and case in `slotHooks.test.ts`.

## Investigation targets
**Required**:
- `packages/testing/src/mockLayer.ts` - test-swap helper
- `packages/query/src/client.ts:12-60` - Tag and Layer pattern
- `packages/core/src/atom/scope.ts` - scope and disposal
- `.flow/memory/bug/` entries on Service Tags and fibers outside builds

## Acceptance
- [ ] `find` and the adapter work with `@sleekstack/query` not installed
- [ ] A missing adapter Layer is a type-level `R` requirement
- [ ] The same record works over two adapter Layers with different envelopes
- [ ] Two concurrent `find` calls for one id make one adapter call; a failure is retried by the next call
- [ ] A response older than the last acknowledgement is dropped
- [ ] Disposing the scope during a `find` interrupts it and writes nothing
- [ ] `useRecord(Post, id)` returns waiting, then success with the record from the map, shows the record during a refetch, and returns a typed failure when the slot is empty and `find` failed, with `@sleekstack/query` not installed
- [ ] `sleekstack check` reports a conditional `useRecord` call (fixture proves it)
- [ ] Tests: `packages/model/src/__tests__/adapter.test.ts`

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
