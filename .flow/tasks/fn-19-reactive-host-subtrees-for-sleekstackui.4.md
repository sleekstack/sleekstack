---
satisfies: [R10]
---
# fn-19-reactive-host-subtrees-for-sleekstackui.4 ui-demo: atom-driven status filter and detail toggle with jsdom test

## Description
Show the feature in the demo (R10): a status filter and a task-detail toggle driven by atoms and plain hooks, changed by React guest controls.

**Size:** M
**Files:** `apps/ui-demo/src/components.tsx`, `apps/ui-demo/src/guests.tsx`, `apps/ui-demo/src/state.ts` (new: atoms), `apps/ui-demo/test/app.test.ts`, `apps/ui-demo/test/fixtures.test.ts`
**Touches:** [apps/ui-demo/src/components.tsx, apps/ui-demo/src/guests.tsx, apps/ui-demo/src/state.ts, apps/ui-demo/test/app.test.ts, apps/ui-demo/test/fixtures.test.ts]

### Approach
- Atoms in `state.ts` (`Atom.make` from `@sleekstack/core`): selected status filter and selected task id.
- A `Columns` component reads the filter with `yield* useAtomValue(filterAtom)` and renders only the matching columns; a host `Toolbar` does `const set = yield* useSetAtom(filterAtom)` and passes it to a guest `FilterBar` (React buttons) as a prop. A `Selected` component reads the selected-task atom and renders the existing `DetailPanel`. No wrapper component anywhere.
- Keep React-only code in `guests.tsx` (no pragma); host files keep `@jsxImportSource @sleekstack/ui` (`apps/ui-demo/src/components.tsx:1`).
- jsdom test: mount `App`, click a filter button, assert that only the reading components' content changes and that the header DOM node is the same object; select a task and assert the detail swaps, including the `TaskNotFound` fallback for an unknown id. `fixtures.test.ts` stays clean (update the `trees` count if it changes).

### Investigation targets
**Required** (read before coding):
- `apps/ui-demo/src/components.tsx`, `apps/ui-demo/src/guests.tsx`
- `apps/ui-demo/test/app.test.ts`, `apps/ui-demo/test/fixtures.test.ts`
- `packages/core/src/atom/Atom.ts:135-175` — `make`, `writable`

### Design context
Demo-only UI; reuse the existing classes in `apps/ui-demo/index.html`.

### Key context
Guest React state inside a swapped subtree is lost; keep the filter bar outside the components that read the filter, or its buttons remount on every click.

## Acceptance
- [ ] Clicking a status filter button re-renders only the components reading the filter; the header DOM node is the same object before and after
- [ ] Selecting a task shows its detail, including the `TaskNotFound` fallback for an unknown id
- [ ] `sleekstack check` on ui-demo is clean, tests and `vite build` pass

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
