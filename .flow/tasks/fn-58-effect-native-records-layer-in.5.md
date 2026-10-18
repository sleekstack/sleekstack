---
satisfies: [R5]
---
# fn-58-effect-native-records-layer-in.5 commit and the derived Draft

## Description
Write path: `commit` and a Draft derived from the record, with `useDraft(spec, src)` and `DraftSpec.toDto` unchanged.

**Size:** M
**Files:** packages/model/src/commit.ts, packages/model/src/record.ts, packages/model/src/draft.ts, packages/model/src/index.ts, packages/model/src/__tests__/commit.test.ts
**Touches:** packages/model/src/commit.ts, packages/model/src/record.ts, packages/model/src/draft.ts, packages/model/src/index.ts, packages/model/src/__tests__/commit.test.ts, packages/analyze/src/components.ts, packages/analyze/src/__tests__/slotHooks.test.ts, packages/analyze/src/__tests__/fixtures/ui-slots/**

### Approach
- `record.commit(id, draft)`: Draft values go through field `serialize` to a typed change, `adapter.save(id, change)` shapes and sends it, the response is hydrated and pushed.
- A second `commit` of one `(type, id)` in flight fails with typed `SaveInFlight`. A failed `serialize`, `save` or response hydrate leaves the map and the Draft unchanged; a hydrate failure after a successful save is a distinct typed failure and the Draft stays dirty.
- `record.useDraft(id)` derives the Draft (editable fields, seeded from the record atom, validated by the field Schemas, holding the Encoded form). It takes a slot even when it delegates to `useDraft`, and the Analyzer recognises hooks only by declaration (`model/draft#useDraft`) and does not follow wrappers, so always add the public record method's line next to it in `packages/analyze/src/components.ts` and a conditional-call fixture plus a case in `slotHooks.test.ts` (that test also finds direct `takeSlot` calls, so it will not notice the omission by itself).
- Baseline after a save: standalone `useDraft` keeps an edited Draft's old seed when its source changes (`packages/model/src/draft.ts`), so reusing that rule would report a Draft returned to the old value as clean. The derived Draft updates its baseline to the acknowledged record and keeps edits made during the save, without changing standalone `useDraft`. Hold this sequence in a test: value A, submit B, edit to C, acknowledge B; then B reads clean and A reads dirty. `defaultValue` seeds a create form's Draft.
- On every acknowledged save, set the slot's `ackedAt` (field added in task 1) and, when task 6's binding is in use, write the acknowledged wire into that record's query entry so the cache converges.
- Pessimistic only: no optimistic shared writes in v1.
- From task 4: the internal helpers `stamp()` and `ingest()` are in `packages/model/src/adapter.ts`; `commit` sets the slot's `ackedAt` with `stamp()` and writes through `ingest()`.
- From task 2: `serialize` receives the Draft's input form and only the encode direction checks it against the transformation's `to` schema first. `commit` must validate Draft values against `to` before calling `serialize`, so an oversized string never reaches `Number()`. A transformed field's wire key is typed `T | undefined`, so keep the key present in the wire object.

### Investigation targets
**Required**:
- `packages/model/src/draft.ts:206-260` - useDraft slot and re-seed rule
- `packages/analyze/src/components.ts:56-63,913-919` - how model hooks are recognised
- `packages/analyze/src/__tests__/slotHooks.test.ts` - slot-hook test and fixtures
**Optional**:
- `.flow/memory/bug/` entries on Draft equality and optimistic layers

## Acceptance
- [ ] `commit` writes the saved record into the map through the adapter and returns typed failures
- [ ] A failed save leaves the map and the Draft unchanged
- [ ] A Draft edited during the save keeps its edits and `dirty` is measured against the new seed
- [ ] An oversized or invalid Draft value fails `commit` with a typed `ParseError` before `serialize` runs
- [ ] A second concurrent `commit` of one record fails with `SaveInFlight`
- [ ] A record with no explicit draft section gets a derived Draft; a date field holds the input string
- [ ] A -> submit B -> edit C -> acknowledge B: B reads clean, A reads dirty, and the C edit made during the save is kept
- [ ] `sleekstack check` reports a conditional `record.useDraft(id)` call (fixture proves it)
- [ ] `useDraft(spec, src)` and `DraftSpec.toDto` pass their existing tests unchanged
- [ ] Tests: `packages/model/src/__tests__/commit.test.ts` and the analyzer slot-hook test

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
