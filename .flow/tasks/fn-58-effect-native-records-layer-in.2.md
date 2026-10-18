---
satisfies: [R3]
---
# fn-58-effect-native-records-layer-in.2 Per-field transformations: defineTransformation and field

## Description
WarpDrive-style per-field transformations on top of the record from task 1. A transformation is a typed value, not looked up by string.

**Size:** M
**Files:** packages/model/src/transformation.ts, packages/model/src/record.ts, packages/model/src/index.ts, packages/model/src/__tests__/transformation.test.ts
**Touches:** packages/model/src/transformation.ts, packages/model/src/record.ts, packages/model/src/index.ts, packages/model/src/__tests__/transformation.test.ts, packages/model/src/__tests__/transformation.test-d.ts

### Approach
- `defineTransformation(name, options => { from, to, hydrate, serialize, defaultValue })` builds an Effect Schema transform; `field(Transformation, options)` attaches it.
- `hydrate` runs inside `push` (wire to record); `serialize` runs in `commit` (task 5) over typed Draft values; `defaultValue` seeds a create form's Draft. Both directions fail with typed `ParseError`.
- No record argument to `hydrate`; a computed value is a derived atom, not a transformation.
- Bound string input before any `Number()` conversion in `serialize` (memory: draft string fields need a bounded length).
- Options are compared structurally, so a new options object per render does not re-seed a Draft (memory: spec equality by named members misses class-instance settings).
- Do not ship built-ins that Effect Schema already covers.

### Investigation targets
**Required**:
- `packages/model/src/model.ts` - Type equals Encoded rule for Draft schemas
- `packages/model/src/draft.ts` - how the spec is compared
- `.flow/memory/bug/` entries on Draft string bounds and spec equality

## Acceptance
- [ ] A transformation hydrates on `push` and the record holds the app value
- [ ] `serialize` and `hydrate` failures are typed `ParseError`, no throw
- [ ] `defaultValue` supplies the value for a field with no value
- [ ] One transformation is reused by two records
- [ ] An oversized string input to a numeric `serialize` fails with a typed error
- [ ] Tests: `packages/model/src/__tests__/transformation.test.ts` and a type test in `transformation.test-d.ts`

## Done summary
Added `defineTransformation(name, options => { from, to, hydrate, serialize, defaultValue })` and `field(transformation, options)` in packages/model/src/transformation.ts. A field Schema is `transformOrFail(UndefinedOr(from), to)`: `hydrate` runs on `push` (wire to `to`'s Encoded, the record holds `to`'s Type), `serialize` runs on encode (`to` validates first, so a bounded `to` stops an oversized string before `Number()`), and an `undefined` wire value takes `defaultValue()`. Structurally equal options return the same field Schema. Tests in packages/model/src/__tests__/transformation.test.ts (one per AC: push hydrate, hydrate ParseError with no write, serialize, oversized input ParseError, defaultValue, reuse by two records, options identity) and transformation.test-d.ts.

Notes for later tasks: a Draft of a transformed field holds `to`'s Encoded; the create-form seed is `Schema.decodeUnknownSync(fieldSchema)(undefined)` (runs `defaultValue`). Serializing a Draft value runs `serialize` over that Encoded value: task 5 must validate it with `to` first (e.g. `Schema.encodeUnknown(Schema.compose(Schema.encodedSchema(to)... ))` or decode via `to` then `Schema.encode(field)`). record.ts needed no change. A transformed field's wire key is typed `number | undefined` (required key).

Baseline: green via handoff (verified at 7bb21e4 by task 1; only .flow/ changed since). Post-edit gate green.

stage: impl-review - ran (codex gpt-6.1-sol fan-out: correctness, contracts, integration all SHIP, 0 findings)
Tier: explicit routing from project CLAUDE.md (implementer: opus at medium)
## Evidence
- Commits: 96178f7a98b7f7b63165abb41e208dfaa90f7e31
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze
- PRs: