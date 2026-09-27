---
satisfies: [R2, R3, R4, R7]
---
# fn-1-sleekstack-effect-native-di-modules-and.3 Core: module(), graph builder with single validation entry, shadowing, Graph value

## Description
Production module + graph builder on top of the spike (R2, R3, R4, R7). All validation completes before construction.

**Size:** M
**Files:** `packages/core/src/module.ts`, `packages/core/src/graph.ts`, `packages/core/src/errors.ts`, `packages/core/src/cycle.ts`, `packages/core/src/index.ts`, `packages/core/src/__tests__/graph.test.ts`, `packages/core/src/__tests__/module.test.ts`
**Touches:** [packages/core/src/**]

## Approach
- `module()` validates name + entry shapes synchronously. Move cycle detection into `buildGraph`, porting the `cycle.ts` DFS but keyed on object identity (not name); imports may be thunks for forward references. `buildGraph` also rejects duplicate names across distinct module objects and dedupes diamonds by identity before provider grouping, keeping all import paths as provenance (spec Architecture: Validation boundaries).
- Add `declareLayer(layer, { provides, requires, lifetime })`: declared raw Layers are full graph nodes.
- Flatten modules with provenance (owning module per entry); resolve shadowing by locality (direct entry > imported), record shadowing in the Graph; same Tag at same precedence -> `AmbiguousProvider`.
- Bare raw Layers must have requirement type `never` (type-enforced); they become opaque nodes with the containing module's lifetime, merged into a base built first; a service requiring a Tag only a bare Layer provides -> `MissingDependency` with a hint to use `declareLayer`.
- Errors as tagged Effect errors (`MissingDependency`, `AmbiguousProvider`, `ModuleCycle`, `DuplicateModule`, `InvalidModule`), messages include module names.
- Internal executable graph (Tags, Layers) plus `snapshot(graph)` -> serializable GraphSnapshot DTO keyed by canonical `tag.key` (spec Architecture: Graph value); exports mark private nodes.

## Investigation targets
**Required:**
- `packages/core/src/cycle.ts` — reuse
- `packages/core/src/__tests__/cycle.test.ts`, `module.test.ts` — existing cases to keep
- `docs/adr/0003-shadowing-over-explicit-overrides.md`

## Acceptance
- [ ] `module()` throws synchronously on missing/empty name
- [ ] Identity cycle through thunk imports -> ModuleCycle with full path
- [ ] Two distinct module objects with the same name -> DuplicateModule; A(new) -> B -> A(old) is DuplicateModule, not a cycle
- [ ] Diamond whose shared module provides a Tag -> no AmbiguousProvider; provenance lists both paths
- [ ] Passing a bare Layer with requirements fails typecheck (type test)
- [ ] Service -> declared Layer and declared Layer -> service dependencies both order correctly
- [ ] Service requiring a Tag only a bare Layer provides -> MissingDependency
- [ ] Local entry shadows imported one; shadowing visible in Graph
- [ ] Ambiguous same-precedence provider errors
- [ ] GraphSnapshot round-trips through JSON.stringify/parse; covers nodes/edges/lifetimes/provenance/opaque/private

## Done summary
Production module()/declareLayer() with synchronous shape validation, buildGraph (identity import walk with thunk cycles -> ModuleCycle, DuplicateModule, diamond dedupe with provenance paths, locality shadowing, AmbiguousProvider incl. partial multi-Tag shadowing, MissingDependency with declareLayer hint, bare Layers as opaque base) and snapshot() JSON DTO; prototype React LayerProvider and playground migrated to the new module shape. Tests: core graph.test.ts, cycle.test.ts, module.test.ts, module-types.test-d.ts.

baseline: green
stage: impl-review - ran (codex: NEEDS_WORK -> SHIP, 2 rounds)
memory capture skipped: memory not initialized
## Evidence
- Commits: 647ddba74cb5b0fa6c2bfe21fee6a46c310cdcfc, f5cbaea2fc2e62cfb9aef9e55da50ac2dfa4a215
- Tests: pnpm typecheck, pnpm test
- PRs: