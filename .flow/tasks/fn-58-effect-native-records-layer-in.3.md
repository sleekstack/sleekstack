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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
