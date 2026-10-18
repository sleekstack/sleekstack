---
satisfies: [R5]
---
# fn-58-effect-native-records-layer-in.5 commit and the derived Draft

## Description
Write path: `commit` and a Draft derived from the record, with `useDraft(spec, src)` and `DraftSpec.toDto` unchanged.

**Size:** M
**Files:** packages/model/src/commit.ts, packages/model/src/record.ts, packages/model/src/draft.ts, packages/model/src/index.ts, packages/model/src/__tests__/commit.test.ts
**Touches:** packages/model/src/**, packages/analyze/src/components.ts (only if a new slot hook is added)

### Approach
- `record.commit(id, draft)`: Draft values go through field `serialize` to a typed change, `adapter.save(id, change)` shapes and sends it, the response is hydrated and pushed.
- A second `commit` of one `(type, id)` in flight fails with typed `SaveInFlight`. A failed `serialize`, `save` or response hydrate leaves the map and the Draft unchanged; a hydrate failure after a successful save is a distinct typed failure and the Draft stays dirty.
- `record.useDraft(id)` derives the Draft (editable fields, seeded from the record atom, validated by the field Schemas, holding the Encoded form). Prefer building it on `useDraft` so no new slot hook is needed; if a new slot hook is unavoidable, add its line next to `model/draft#useDraft` in the analyzer and cover it in the slot-hook test.
- A pristine Draft re-seeds from the pushed record by the existing rule; an edited Draft keeps its edits. `defaultValue` seeds a create form's Draft.
- Pessimistic only: no optimistic shared writes in v1.

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
- [ ] A second concurrent `commit` of one record fails with `SaveInFlight`
- [ ] A record with no explicit draft section gets a derived Draft; a date field holds the input string
- [ ] `useDraft(spec, src)` and `DraftSpec.toDto` pass their existing tests unchanged
- [ ] Tests: `packages/model/src/__tests__/commit.test.ts`; analyzer test only if a hook is added

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
