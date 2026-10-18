---
satisfies: [R1]
---
# fn-58-effect-native-records-layer-in.1 Identity map: defineRecord, registry, push, atom, evict

## Description
The core of the records layer: a record definition and the per-Store identity map. Proves the approach (see spec Early proof point). Fields are plain Effect Schema here; transformations, relationships and the adapter come in later tasks.

**Size:** M
**Files:** packages/model/src/record.ts, packages/model/src/registry.ts, packages/model/src/index.ts, packages/model/src/__tests__/record.test.ts
**Touches:** packages/model/src/record.ts, packages/model/src/registry.ts, packages/model/src/index.ts, packages/model/src/__tests__/record.test.ts

### Approach
- `defineRecord(type, { fields })` returns the record: `atom(id)` (Atom of Option of the record), `push(wire)` (Effect, needs the Store as a Service, decodes with the fields' Schema, whole-record replace), `evict(id)`.
- One `keepAlive` registry atom per Store holds a map from type and id to a writable slot atom; do not use `Atom.family`. `evict` resets the slot to `None` and keeps the atom.
- Follow the Store access and slot pattern in `packages/model/src/draft.ts` (imports from the ui internal entry). Retention: `Atom.keepAlive` at `packages/core/src/atom/Atom.ts:196`; idle removal at `packages/core/src/atom/AtomStore.ts:418`.
- Each slot also holds `ackedAt` (time of its last acknowledged save, initially none); task 5 sets it and task 6 reads it, so no later task edits the registry.
- Ids are strings. A decode failure is a typed `ParseError` and writes nothing.

### Investigation targets
**Required**:
- `packages/model/src/draft.ts:1-5,206-230` - Store access, slot and no-component fallback
- `packages/core/src/atom/AtomStore.ts:418,452-470,577-585` - idle removal, retain and release
- `packages/core/src/atom/Atom.ts:190-200,241` - keepAlive and why family is not used
**Optional**:
- `.flow/memory/bug/` entries on atom invalidation, fibers outside builds

### Key context
An unread `push` is dropped on the next microtask unless the atom is kept alive. A pushed record that nobody reads must still survive until scope disposal or `evict`.

## Acceptance
- [ ] Pushing one type and id from two sources yields one atom and one value
- [ ] A record nobody reads survives a microtask turn and is readable later
- [ ] `evict` then `push` of the same id reuses the same atom and shows the new value
- [ ] A decode failure is a typed `ParseError`, writes nothing, and leaves the previous value
- [ ] A slot exposes `ackedAt`, unset until a save is acknowledged
- [ ] Disposing the Store scope releases the registry
- [ ] Tests: `packages/model/src/__tests__/record.test.ts`

## Done summary
Added the records identity map to @sleekstack/model: `defineRecord(type, { fields })` with `atom(id)`, `push(wire)` and `evict(id)`, backed by one keepAlive registry atom per Store holding a keepAlive slot (`value`, `ackedAt`) per type and id; tests in packages/model/src/__tests__/record.test.ts cover every acceptance item, including the ParseError case.

Notes for later tasks: `slotOf(store, type, id)` and `recordAtom(type, id)` live in packages/model/src/registry.ts (internal, not exported). The public reader atom is held weakly by `Atom.family` because it holds no state; the slots stay `keepAlive` and never use `family`. `Atom.make` runs an `Option` as an Effect, so a derived atom returning `Option` must use `Atom.writable`. `evict` keeps `ackedAt`. SSR: no record atom is serializable (client-only, per spec).
stage: plan-sync - skipped(no downstream drift beyond the spec's Atom.family sentence, updated by the conductor)
Baseline: not run before the first edit (the dependency builds ran first on the post-edit gate run). Post-edit gate green.

stage: impl-review - ran (codex gpt-6.1-sol: fan-out NEEDS_WORK, two findings fixed, re-review SHIP)
Tier: explicit routing from project CLAUDE.md (implementer: opus at medium)
## Evidence
- Commits: cfd804af3fcfb44a7b35fe01281b60a8f0c301c4, 7bb21e46701bd9b7fad4e654c53ce9210483cb37
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/model... --filter=@sleekstack/analyze
- PRs: