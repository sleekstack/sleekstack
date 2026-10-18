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
Added `record.commit(id, draft)` and `record.useDraft(id)` in packages/model/src/commit.ts and record.ts. `commit` runs the Draft's `toDto()`, which decodes the input (a transformed field's `to` checks it before `serialize`) and encodes it to a change. It then calls the adapter's `save`, hydrates the response and writes it into the slot with `ackedAt = stamp()`. The save is forked into a per-Store scope. A second commit of one record fails with `SaveInFlight`. A response that does not hydrate, or that is another record, fails with `SaveResponseError`. Any failure leaves the map and the Draft unchanged.

`record.useDraft(id)` delegates to `useDraft` with a derived spec. The Draft holds every field except `id` in input form: a date as its string, a `field(...)` as `to`'s Encoded. A missing record is seeded from `defaultValue`. The spec carries the internal `FOLLOWS` mark from draft.ts, so an edited Draft moves its seed to the new record and keeps its edits. Standalone `useDraft` is unchanged.

The analyzer checks `model/record#useDraft`. The ui-slots fixture has a good call and a conditional call. slotHooks.test.ts has a case that requires every `use*` method of `RecordDefinition` to be checked. Tests in packages/model/src/__tests__/commit.test.ts cover one AC each:
- save writes the acknowledged record
- save failure, unreadable response or another record: map and Draft unchanged
- oversized input: ParseError before `serialize`
- `SaveInFlight`
- derived Draft input forms, date string and create-form defaults
- the A, submit B, edit C, ack B sequence

Each was checked to fail first: the FOLLOWS rule, the in-flight guard and the analyzer line.

Deviation: packages/model/src/transformation.ts is outside Touches but changed (type only). `TransformedField` is now an interface carrying `readonly to: To` (true at runtime), so `RecordInput` can type a transformed field's Draft as `Encoded<To>`. All three reviewers flagged the guessed type without it. `record.useDraft` is typed `never` for fields whose Schemas need a Service, because Draft seeding is synchronous. Not done: writing the acknowledged wire into the query entry (task 6 binding). The ack is one direct slot update, not `ingest()`, because an ack always wins.

New public names for task 7: `SaveInFlight`, `SaveResponseError`, `SaveError`, `RecordDraft`, `RecordInput`, `RecordChange`.

Baseline: green via handoff (verified at dda089c by task 4; only .flow/ changed since). Post-edit gate green.
stage: impl-review - ran (codex gpt-6.1-sol fan-out NEEDS_WORK: Draft input type of a transformed field, response id not checked, seeding without Services; fixed; re-review SHIP)
Tier: explicit routing from project CLAUDE.md (implementer: opus at medium)
## Evidence
- Commits: dec4ab79e3a15dde3e66f8035b9ea26f14979030, bc1dd39b98d372ebe98cf92a7c9082d9e95e31aa
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze
- PRs: