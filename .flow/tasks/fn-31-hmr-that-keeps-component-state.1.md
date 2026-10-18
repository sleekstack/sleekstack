---
satisfies: [R1]
---
# fn-31-hmr-that-keeps-component-state.1 Runtime hot update: stable ids, function swap, keep useLocal slots

## Description
Add an explicit hot-update mode to the ui renderer so a swapped component function re-runs its live instances with their `useLocal` slots intact. Runs first: it proves state survives a swap before any plugin work.

**Size:** M
**Files:** packages/ui/src/reactive.ts, packages/ui/src/dom.ts, packages/ui/src/index.ts (or internal.ts), packages/ui/src/__tests__/hmr.test.ts (new)
**Touches:** [packages/ui/src/reactive.ts, packages/ui/src/dom.ts, packages/ui/src/index.ts, packages/ui/src/internal.ts, packages/ui/src/__tests__/hmr.test.ts]

### Approach
- `fnId` (reactive.ts ~204) and `frame.ordinals` (keyed by function, ~109/1092) are per-function; when fn-29's stable id is present for a function, use it for `fnId` and key ordinals by that id so a re-evaluated module keeps instance ids. Without the plugin ids behave as today.
- Add registry `acceptUpdate(id, fn)`: swaps the function behind the id and forces a re-run of its live instances (reuse the existing forced re-run path in `instance`, ~1085).
- A throwing update keeps the previous function and reports the error (R1 error case).
- Tests follow the style of `slot-hook.test.ts` and `reactive-dom.test.ts`; focus retention checked on a mounted input.

### Investigation targets
**Required**:
- packages/ui/src/reactive.ts:200-210, 1070-1110, 1180-1200
- packages/ui/src/dom.ts — how instances re-run and keep nodes
- .flow/specs/fn-29-sleekstack-vite-plugin.md R5 — stable id contract
**Optional**:
- packages/ui/src/__tests__/slot-hook.test.ts

## Acceptance
- [ ] After `acceptUpdate`, a mounted instance shows new output and keeps `useLocal` state and input focus
- [ ] A throwing update keeps the old function and reports the error
- [ ] Without stable ids, current behavior and existing tests unchanged
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui...` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
