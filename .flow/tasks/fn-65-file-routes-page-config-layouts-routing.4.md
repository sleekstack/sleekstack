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
`sleekstack check` now reads a router whose `pages` and `notFound` come from `virtual:sleekstack/routes`. It reads them through `routes.gen.d.ts`: each `Page<typeof import('./x')>` resolves to its route module. The default export is checked as `<Default />` through the shared JSX element path, so `fromReact` and `lazy` defaults match a literal router. The `loaders` export is checked as a page's loaders, under the same `Route` provide node. A missing service is reported at the route file's `file:line`. A hand-written literal router checks as before.

Following the conductor's decision to widen Touches (the spec's "larger declaration" fallback), ui-vite's `declaration()` now types `notFound` from its module: `Page<typeof import("./_notFound.tsx")>["render"]`. It is still types-only (ADR 0045). The analyzer therefore finds `_notFound` through the declaration under any tsconfig, including a `files` list.

A declaration that disagrees with the route files produces one `Unresolved` naming the mismatch, and nothing is guessed. That covers a declared file that is missing, a route file the declaration leaves out, and an old bare-`Render` `notFound`. The ui-vite README note telling users to write pages out is replaced.

Tests in packages/analyze/src/__tests__/components.test.ts:
- Fixture `ui-router-file-routes`: render missing Db, loaders missing Db, a lazy route's LazyLoadError, a clean fromReact route, a clean fully provided `handle` root, and an ignored `_Helper.tsx`.
- Fixture `ui-router-file-routes-stale`: a missing file and an unlisted file.
- A `tsconfig.files.json` case: same diagnostics, with `notFound` nodes at `routes/_notFound.tsx:3`.
- `expected()` now reads markers in subdirectories.
- The ui-vite declaration pin is in packages/ui-vite/src/__tests__/routes.test.ts.

Playground: it checks clean with `router({ table, pages, notFound })`, verified with a temporary edit that was reverted. `app.tsx` still has its hand-written pages, which task 8 can switch. Its committed `routes.gen.d.ts` has no `_notFound`, so it is unaffected.

baseline: green (pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite...)
Fixture graph check: output unchanged.

Tier: implementer (project routing block: opus at medium)
stage: impl-review - ran (codex fan-out rid 1a57f4e005474ac992ab4c4a34e0bc00 NEEDS_WORK x2 findings; round 2 NEEDS_WORK on _notFound; round 3 SHIP)
## Evidence
- Commits: f25c2d8d07b17e8e19f48e0ec35e1117740a603d, e1c8a8424adcf7883f6e0bf97286d1d7c123164b, 8f1f23522f1b660eab86024e38f8ecaf2e48c9a2
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/analyze --filter=sleekstack --filter=@sleekstack/ui-vite..., fixture graph check (packages/cli effect-app): output unchanged
- PRs: