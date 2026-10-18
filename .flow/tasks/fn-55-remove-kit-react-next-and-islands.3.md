---
satisfies: [R2]
---
# fn-55-remove-kit-react-next-and-islands.3 devtools: SleekStackDevtools panel (graph, scopes, errors, atoms, queries) on ui

## Description
Rewrite the runtime panel (`SleekStackDevtools`: graph, live scopes, services, errors, atoms of open stores, queries) as ui components polling the feed handler from task 1, and drop `@sleekstack/react` and `react` from the package.

**Size:** M
**Files:** packages/devtools/src/index.tsx, packages/devtools/src/panel/*.tsx, packages/devtools/src/atoms/useStoreAtoms.ts, packages/devtools/src/graph/graphsOf.ts, packages/devtools/src/__tests__/devtools.test.tsx, packages/devtools/package.json, README
**Touches:** [packages/devtools/**]

### Approach
- Replace React hooks with ui slot hooks and `useAtomValue`; the store the panel inspects is the ui `Store` (not the removed React provider registry), so decide how a ui app exposes its stores to the panel (the `uiTrace` store path already does) and record it in the task summary.
- Keep `graphsOf` and the query section; drop the dependency on the React adapter's internal store registry.
- Poll the runtime feed handler's JSON; point the default URL at the documented route.
- Equivalence pin: the existing devtools test assertions are kept (converted to `@sleekstack/testing`).

### Investigation targets
**Required**:
- `packages/devtools/src/index.tsx`, `panel/queries.tsx`, `panel/sections.tsx`, `atoms/useStoreAtoms.ts`, `graph/graphsOf.ts`
- `packages/devtools/src/__tests__/devtools.test.tsx`
- `packages/react/src/` (what `useProviderAtomStore` and `atomStores` did, to replace)
- `packages/query/src/ui.ts`
**Optional**:
- `docs/adr/0013-framework-agnostic-runtime-package.md` (atom store inspection note)

## Acceptance
- [ ] The panel shows graph roots, live scopes, services, atoms of open stores, queries and errors, from the feed handler
- [ ] `@sleekstack/devtools` declares no `react`, `react-dom` or `@sleekstack/react` dependency
- [ ] A bundle test (existing marker) shows the panel stays out of production client chunks when mounted behind a dynamic import
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/devtools...` is green

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
