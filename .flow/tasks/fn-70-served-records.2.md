---
satisfies: [R1, R2, R3]
---
# fn-70-served-records.2 model: readOnly fields, record.change and the record error classes

Touches: [packages/model/src/**]

## Description
The client-safe vocabulary the server and the generated client share: a read-only field marker, the PATCH body Schema, and the two typed errors. No HTTP code in this package.

**Size:** M
**Files:** `packages/model/src/record.ts`, `packages/model/src/commit.ts`, `packages/model/src/errors.ts` (new), `packages/model/src/index.ts`, `packages/model/src/__tests__/record.test.ts`, `commit.test.ts`, `exportNames.test.ts`, `bundle.test.ts`, a new `readonly.test-d.ts`

### Approach
- `readOnly(schema)` annotates the Schema (an AST annotation, as `field(...)` marks a transformed field in `packages/model/src/transformation.ts`) and brands its type, so `Editable<F>` and `RecordChange<F>` (`commit.ts:25-38`) omit it, as they omit `id`. `derivedSpec` (`commit.ts:61`) filters the same set of keys; keep ONE predicate for "editable" and use it in the type-level filter, `derivedSpec` and `change`.
- `record.change` is `Schema.Struct` of the editable fields' wire (Encoded) form, built where `defineRecord` builds `schema` (`record.ts:102-140`); put it on `RecordDefinition` (`record.ts:21`). Keep Effect Schema's default excess-property behavior (drop), never `onExcessProperty: 'error'`.
- `RecordNotFound` and `RecordRejected` as `Data.TaggedError`, next to `SaveInFlight` (`commit.ts:11`) in style; the fields are exactly those in the spec's API Contracts.
- Behavior pin for `commit`/Draft: the existing `commit.test.ts` and `draft.test.ts` pass unchanged for records with no `readOnly` field.

### Investigation targets
**Required**:
- `packages/model/src/commit.ts:25-108` - Editable, RecordChange, derivedSpec
- `packages/model/src/record.ts:15-140` - RecordFields, definitions, defineRecord overloads
- `packages/model/src/transformation.ts` - how a field is marked at run time and in the type
- `packages/model/src/__tests__/bundle.test.ts` and `exportNames.test.ts` - the guards this must keep green

**Optional**:
- `packages/model/src/__tests__/transformation.test-d.ts` - type-test style

### Acceptance
- [ ] A `readOnly` field is in the record and in `record.schema`, and absent from `RecordChange`, `record.change` and the Draft's `toDto()` (named tests, runtime and type-level)
- [ ] `record.change` drops an unknown key and a read-only key, fails on a missing or malformed editable field, and accepts `{}` for a record with no editable field
- [ ] `RecordNotFound` and `RecordRejected` are exported and listed in `exportNames.test.ts`; the Draft-only bundle test still passes
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze` passes; fixture graph check output unchanged

## Acceptance
- [ ] TBD

## Done summary
Added `readOnly(schema)` (an AST annotation plus a type brand), one `editableFields` predicate that `Editable<F>`/`RecordChange`, the derived Draft and `record.change` share, `record.change` on every `RecordDefinition` (encodedBoundSchema of the editable fields; a record with no editable field drops every key and accepts `{}`), and the `RecordNotFound`/`RecordRejected` tagged errors in a new `errors.ts`. Tests: `record.test.ts` "readOnly fields and record.change" block (R1 runtime, related through a readOnly ref, R2 drop/missing/malformed/refined/empty cases, R3 errors), `readonly.test-d.ts` (type level: RecordChange, change, Draft field, non-Schema rejected, exact error fields), `exportNames.test.ts` lists the new names, and `bundle.test.ts` now also excludes `errors.ts` from a Draft-only bundle. Fixture graph check output identical before and after.

Tier: implementer (actual model: claude-opus-5-5)
stage: impl-review - skipped(config: REVIEW_MODE=none)
## Evidence
- Commits: 3c128733bd7a3ea3c096a8edbb5cff679cbae809
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze, fixture graph check (effect-app check --json --entry runtime.ts): identical before/after
- PRs: