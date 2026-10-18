---
satisfies: [R3]
---
# fn-58-effect-native-records-layer-in.2 Per-field transformations: defineTransformation and field

## Description
WarpDrive-style per-field transformations on top of the record from task 1. A transformation is a typed value, not looked up by string.

**Size:** M
**Files:** packages/model/src/transformation.ts, packages/model/src/record.ts, packages/model/src/index.ts, packages/model/src/__tests__/transformation.test.ts
**Touches:** packages/model/src/**

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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
