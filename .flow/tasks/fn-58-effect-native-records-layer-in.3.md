---
satisfies: [R2]
---
# fn-58-effect-native-records-layer-in.3 Relationships: ref, refs, related as live derived atoms

## Description
To-one and to-many relationships as derived atoms over the identity map. They never fetch on read.

**Size:** M
**Files:** packages/model/src/relations.ts, packages/model/src/record.ts, packages/model/src/index.ts, packages/model/src/__tests__/relations.test.ts
**Touches:** packages/model/src/relations.ts, packages/model/src/record.ts, packages/model/src/index.ts, packages/model/src/__tests__/relations.test.ts

### Approach
- `ref(() => Other)` (to-one, `null` or a `RecordRef`) and `refs(() => Other)` (to-many, ordered list of `RecordRef`); `record.related(id, field)` returns one stable atom per id and field.
- `RecordRef { id, value: Option of the record }`. Missing targets keep their id and position; server order is kept; duplicates are kept as given.
- The read depends on the registry slot (task 1) so a late `push` of a missing target re-runs it. Lazy `() => Other` handles cycles; reads must not recurse eagerly.
- No inverse sync. One direction is authoritative; document that a reverse view covers loaded records only.
- Memory: the Store tracks visits during invalidation; add a test for a derived chain with a late dependency.

### Investigation targets
**Required**:
- `packages/core/src/atom/Atom.ts:60-110,163-178` - derived atom shapes
- `packages/model/src/draft.ts` - `field(name)` returns one stable atom per name, same idea
- `.flow/memory/bug/` entry on atom invalidation tracking visits

## Acceptance
- [ ] A `related` atom updates when either the owner or a target record changes
- [ ] A missing target keeps its id and position, and fills in when it is pushed later
- [ ] Reading a relationship starts no request
- [ ] A cyclic definition (post to author to post) reads without looping
- [ ] `related(id, field)` returns the same atom on every call
- [ ] Tests: `packages/model/src/__tests__/relations.test.ts`

## Done summary
Added `ref(() => Other)` and `refs(() => Other)` relationship fields and `record.related(id, field)` in packages/model/src/relations.ts (wired into `defineRecord` in record.ts, exported from index.ts). A field holds target ids (`string | null` or `string[]` on the wire and in the record); `related` is one `Atom.family` atom per id and field per definition that reads the owner's record atom and each target's record atom, so an owner change, a target change or a late push of a missing target re-runs it; it never fetches. Value: `Option` (None while the owner is absent) of `RecordRef { id, value: Option }` or `null` for `ref`, and an ordered list for `refs` with missing targets and duplicates kept. The target thunk is called only on read, so cycles work; TypeScript needs one side's fields spelled out as a type for a cycle (documented on `ref`, shown in the test). A non-relation field name throws `TypeError`. Tests in packages/model/src/__tests__/relations.test.ts, one per AC (owner and target change, missing target fills in through the subscribed chain, no request on read, cyclic read, stable atom), mutation-checked red.

Notes for later tasks: `RelationKey<F>` types the `field` argument. No inverse sync; a reverse view covers loaded records only (TSDoc on `related`). New public names `ref`, `refs`, `RecordRef`, `RefField`, `RefsField`, `Related`, `RelationTarget`, `RelationKey` for task 7's uniqueness guard.

stage: impl-review - ran (codex gpt-6.1-sol fan-out: correctness, contracts, integration all SHIP, 0 findings)
stage: plan-sync - skipped(no drift; new public names noted in task 7)
Baseline: green via handoff (verified at 96178f7 by task 2; only .flow/ changed since). Post-edit gate green.
Tier: explicit routing from project CLAUDE.md (implementer: opus at medium)
## Evidence
- Commits: fda3dfe7d453dc0d18af8d21a25128cf19c522a0
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze
- PRs: