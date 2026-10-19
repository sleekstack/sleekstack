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
`SleekStackDevtools` is now a `@sleekstack/ui` generator component. It polls the `@sleekstack/runtime/devtools` feed through ui `useLocal` and `useEffect` and shows graph roots, live scopes, service acquire/release, errors, queries and atoms. `@sleekstack/devtools` no longer declares `react`, `react-dom`, `@sleekstack/react`, `@testing-library/react` or `@types/react*`. `@sleekstack/ui` is its only peer.

How a ui app exposes its stores to the panel: through the `uiTrace` store path. The new `trace` prop lists the atoms of every open store the trace observed (`trace.observer(store)`). A store counts as open while a mount it was given still has live instances; a store that throws on `inspect()` is skipped. `atoms` prop values are read from the panel's own ui `Store`, and that store's copy is hidden so the prop label wins, as before. The React provider registry (`atomStores`, `useProviderAtomStore`) is no longer used.

- Queries tab: reads the client with `Effect.serviceOption(QueryClientTag)`. No client gives the empty state. A failing client layer fails where it is provided, through `onError` or a rejected mount, and is never swallowed. Production renders nothing.
- Default endpoint stays `/api/devtools`. The README documents serving the handler there and passing the peer address (Bun `server.requestIP(request)?.address`, Node `req.socket.remoteAddress`), which the task .1 handler requires.
- Equivalence pin: all 17 original `devtools.test.tsx` cases are kept with their assertions, ported to `@sleekstack/testing` render and `@testing-library/dom` `screen`. Store-registry setups became traced mounts. The "unmount" case is now `dispose`. The hung-request case installs fake timers before render.
- Bundle test: the old marker test lived in the removed Next showcase, so I added a new one in this package. `src/__tests__/bundle.test.ts` builds `fixtures/lazyPanel.tsx`, which mounts the panel behind a dynamic import guarded by `NODE_ENV`. The production build has neither `DEVTOOLS_MARKER` nor `QUERY_DEVTOOLS_MARKER` in any chunk; the development build has both in a lazy chunk and neither in the entry. I confirmed it goes red when the guard is removed.
- Outside `packages/devtools/**`: `pnpm-lock.yaml` only (the dropped React deps, plus `vite` and `@testing-library/dom` as devDependencies). No `apps/sleek-codes` entries. Showcase and its architecture and fixtures tests needed no change.
- Follow-ups for task .7: the docs pages `nextjs.mdx`, `index.mdx`, `queries.mdx` and ADR 0013 still describe the Next handler and the `LayerProvider` store registry. `packages/devtools/tsconfig.json` still has `"jsx": "react-jsx"`; every file uses the ui pragma, so it is harmless.

Gate: `pnpm turbo run test typecheck --filter=@sleekstack/devtools... --filter=showcase` was green, 17/17 tasks. The first run failed 2 showcase transitions-timing tests (`app.test.ts` transitions page, `transitions.test.ts`). Those tests do not touch this package. They passed on the immediate re-run, so I counted them as a load flake.
baseline: green (same command, pre-edit, cached)

Tier: opus at medium

stage: impl-review - failed(codex fan-out --base master: all 3 draws (correctness, contracts, integration) produced no output and timed out at 2133s; this task's codex exec processes were killed at ~31 min per the hang rule; no verdict, transport failure refunded by flowctl)
## Evidence
- Commits: ac430a0fdecc3c192a4cfbd988c7ed80bc2111d6
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/devtools... --filter=showcase
- PRs: