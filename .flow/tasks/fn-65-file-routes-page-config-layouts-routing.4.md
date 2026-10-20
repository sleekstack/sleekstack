---
satisfies: [R4]
---
# fn-65-file-routes-page-config-layouts-routing.4 analyze: sleekstack check reads routers built from virtual:sleekstack/routes

Touches: packages/analyze/src/components.ts, packages/analyze/src/__tests__/components.test.ts, packages/analyze/src/__tests__/fixtures/, packages/ui-vite/README.md

## Description
Early proof point. Make `routerOf` / `routerRoot` read a router whose `pages` and `notFound` come from `virtual:sleekstack/routes`, resolving the import through `routes.gen.d.ts` to each route module, and build the same nodes as for a literal. A hand-written literal keeps working.

**Size:** M
**Files:** `packages/analyze/src/components.ts`, `packages/analyze/src/__tests__/components.test.ts`, `packages/analyze/src/__tests__/fixtures/ui-router-file-routes/` (new), `packages/ui-vite/README.md` (drop the 'write pages out' note)

### Approach
- Today `routerOf` (`components.ts:726-734`) accepts an object literal, a `router({ ... })` call or a const binding, and `routerRoot` (`~775-810`) needs `pages` as an object literal of page object literals with a readable `render` and `loaders`. Passing `pages` from the virtual module fails with `Router pages are not a readable object literal`; the ui-vite README says to write pages out (line ~51).
- Mechanism (contract, not code): when `pages` is an identifier imported from `virtual:sleekstack/routes`, resolve the module's declaration (`routes.gen.d.ts`, ADR 0045; the type of each `pages[name]` names its route module), and for each route read the module's default component (render node) and `loaders` export (loaders node) with the existing `renderNode` / `loadersNode` logic, under the same `Route` provide node. Same for `notFound` from `_notFound`. If the declaration is missing or does not match the files, report an `unresolved` node with a message naming the declaration, never guess.
- Fixture: add `ui-router-file-routes` beside `ui-router-link` and `ui-router-roots` and register it in `components.test.ts` (see how `ui-router-link` was added in fn-62). Cases: a page whose render needs a service the app layer does not provide (reported), a page whose loaders need one (reported), a clean app, and a stale declaration (reported).
- `AnalyzeCode` is a closed union (AGENTS.md): reuse the existing code; a new code needs its table row (rule, fix, docs).
- The early check: this task decides whether the declaration is enough. If it is not, stop and report; the spec's Early proof point lists the fallback.

### Investigation targets
**Required**:
- `packages/analyze/src/components.ts:700-830`
- `packages/analyze/src/__tests__/components.test.ts` (fixture registration), `fixtures/ui-router-link/`
- `docs/adr/0045-vite-plugin-route-declaration.md`, `packages/ui-vite/README.md:45-55`

### Acceptance
- [ ] A router built from `virtual:sleekstack/routes` reports a missing service of a route file's render, and of its loaders, with the route file's `file:line`
- [ ] A clean file-route app produces no diagnostics; the playground app checks clean with no hand-written pages
- [ ] A declaration that disagrees with the files is reported, not guessed; a hand-written literal router checks as before
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite...` green and the fixture graph check output is unchanged (AGENTS.md)

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
