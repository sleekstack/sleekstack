---
satisfies: [R4, R5, R6, R12]
---
# fn-45-devtools-for-ui.3 Devtools panels and the ui peer dependency

## Description
Devtools panels and the ui peer dependency. Contract and rationale are in the parent spec (R-IDs above).

**Size:** M
**Files:** packages/devtools/package.json, packages/devtools/src/panel/*, a new ui panel module, packages/devtools/src/__tests__
**Touches:** [packages/devtools/**]

### Approach
- Add `@sleekstack/ui` as a peer of the devtools package; reuse panel/sections.tsx and the polling pattern of useStoreAtoms with a ring buffer fed by the observer.
- Four views: instance tree (keys, slots), atoms per instance (match slot atoms against `store.inspect()`), re-run reasons, effect runs. Do not trust data-sleek markers from guest markup (memory entry).

## Acceptance
- [ ] Tree, atoms, re-run reasons and effect runs render for a mount (R4, R5, R6)
- [ ] Dependency direction is devtools to ui only (R12)
- [ ] RTL tests call cleanup explicitly


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
