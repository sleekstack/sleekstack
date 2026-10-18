---
satisfies: [R3]
---
# fn-60-docs-site-on-ui-and-start.4 docs app: the cmd-K search dialog over the build-time index

## Description
A cmd-K dialog component that searches the build-time index with the platform's client search function. Keyboard accessible; a message for no results; an error when the index cannot load.

**Size:** S
**Files:** apps/docs/src/search/SearchDialog.tsx, tests in apps/docs/src/__tests__/
**Touches:** [apps/docs/src/**]

### Approach
- Uses the search client function and index format from the platform spec (`packages/ui-vite`, task fn-59.5); this task needs that spec done.
- Open on cmd-K or ctrl-K, close on escape, focus moves into the input, arrow keys move through results and enter navigates; an accessible name and role for the dialog and listbox.
- Index load failure shows an error message in the dialog, never a blank list; empty query shows nothing.

### Investigation targets
**Required**:
- `packages/ui-vite/src/search-client.ts` (from the platform spec) and the layout components from task .3
- `.flow/charts/fn-57/5.md` (the search decision)
**Optional**:
- `apps/docs/app/api/search/route.ts` (today's behavior)

## Acceptance
- [ ] Tests cover open and close by keyboard, focus, arrow navigation and enter to navigate
- [ ] No results shows a message; an index load failure shows an error instead of a blank dialog
- [ ] `pnpm turbo run test typecheck --filter=docs` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
