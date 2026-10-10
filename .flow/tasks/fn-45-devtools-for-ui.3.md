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
Added `uiTrace()` (a recorder whose `observer(store)` is passed as a ui mount's `observe`) and `<UiPanel trace>` in @sleekstack/devtools: instance tree per mount with keys, slots and adopt marks, atoms per instance with current values from each mount's own store, re-run reasons and effect runs, rows labeled by mount and instance id. `@sleekstack/ui` is a peer (and dev) dependency of devtools; ui does not depend on devtools. Test: packages/devtools/src/__tests__/uiPanel.test.tsx (two mounts, two stores, explicit RTL cleanup). README section added; ADR 0037 and ui-demo wiring are left to task .4.

Pre-existing bug, not fixed here: when a component's direct child switches from an instance to a plain element, the old instance is never disposed.

Tier: implementer opus at medium
stage: impl-review - ran (codex fan-out NEEDS_WORK: single store for several mounts and ambiguous row identity, fixed; re-review SHIP)
baseline: green (devtools tests at base)
## Evidence
- Commits: c68449eae3de5c7d6486a607b504b72a4e70c4c0, d1692ba228c66165eed30b8e8a7484b28c506f2b, 28fbc789d59aba0a4b2715d87f0f3c78a81addc0
- Tests: pnpm turbo run test typecheck --filter=...@sleekstack/devtools
- PRs: