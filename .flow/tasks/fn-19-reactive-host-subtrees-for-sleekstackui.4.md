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
ui-demo now has `filterAtom` / `selectedAtom` (src/state.ts). `Columns` re-renders on the status filter; `Selected` re-renders on the picked task and wraps `DetailPanel`. A host `Toolbar` hands `useSetAtom` setters to guest `FilterBar` buttons and sits outside the readers, so the buttons never remount. The jsdom test in test/app.test.ts checks that the header, team and filter-button nodes stay the same objects and that the detail swaps t2 -> t1 -> TaskNotFound("nope") -> t3. `@sleekstack/core` was added to ui-demo deps with a 3-line lockfile change; the unrelated sleek-codes importer was stripped. `fixtures.test.ts` needed no change because the trees count is still 1.

Tier: opus at medium
baseline: green via handoff (verified at 6654a0b by fn-19.3)
stage: impl-review - ran (codex fan-out, 3 draws SHIP, 0 findings)
## Evidence
- Commits: 788537da297cb987e94723fc309157ab465465d3
- Tests: cd apps/ui-demo && npx vitest run && npx tsc --noEmit && npx vite build, pnpm --filter @sleekstack/ui test, pnpm --filter @sleekstack/analyze test
- PRs: