---
satisfies: [R5]
---
# fn-65-file-routes-page-config-layouts-routing.5 ui-vite and analyze: _layout.tsx layouts composed at generation

Touches: packages/ui-vite/src/routes.ts, packages/ui-vite/src/__tests__/routes.test.ts, packages/analyze/src/components.ts, packages/analyze/src/__tests__/components.test.ts, packages/analyze/src/__tests__/fixtures/ui-router-file-routes/

## Description
Add `_layout.tsx`: its default export is a component taking `children`, its optional `loaders` export is merged into every page below it. The module wraps each page's `render` in the layouts of its directory chain (outer first) and merges loaders outer-first, each loader once. `notFound` is not wrapped. The analyzer reads the layout chain.

**Size:** M
**Files:** `packages/ui-vite/src/routes.ts`, `packages/ui-vite/src/__tests__/routes.test.ts`, `packages/analyze/src/components.ts`, the analyzer test and its fixture

### Approach
- Plugin: collect `_layout` files (task 2 keeps them out of the route list); for a route at `a/(g)/b.tsx` the chain is the layouts at the routesDir root, `a/`, `a/(g)/` that exist. `render: () => jsx(L1, { children: jsx(L2, { children: jsx(Page, {}) }) })`. `loaders` = layout loaders (outer first) then the page's, deduped by identity (loader keys are loader key plus pathname, `loader.ts` `keyOf`, so a shared loader is one entry). The router is unchanged and the fn-64 stale rule is untouched.
- A `_layout` with no default export fails naming the file; a layout inside a `_` directory is ignored with its subtree (task 2 rule); a layout does not become a route.
- Declaration: each page's type must reflect its layouts' loaders requirements so `router()` infers them; extend the page type from task 3.
- Analyzer: add the layout components and loaders to the page's nodes under the same `Route` provide (a layout needing `Route` is satisfied; a layout needing an unprovided service is reported with the layout file's `file:line`). Add fixture cases to `ui-router-file-routes`.
- Document in the code and the ADR that layouts remount on navigation and that `notFound` gets no layout (its loaders would not run).
- Tests first: nesting order, group layout scope, dedupe, redirecting layout loader (a layout guard redirects every page below it: cover through `handle` or the `resolve` path used by `navigation.test.ts` helpers if easy, else in the plugin test via generated pages), no-default-export error.

### Investigation targets
**Required**:
- `packages/ui-vite/src/routes.ts`, `packages/router/src/loader.ts:1-60` (`keyOf`)
- `packages/analyze/src/components.ts:775-810`
- `docs/adr/0050-file-routes-layouts-and-lazy-pages.md` (from task 2)

### Acceptance
- [ ] A page renders inside its directory chain of layouts, outer first, groups included; a root layout wraps everything except `notFound`
- [ ] Layout and page loaders merge outer-first, each loader once; a redirecting layout loader redirects pages below it
- [ ] A layout with no default export fails naming the file; a layout under a `_` directory is not applied
- [ ] `sleekstack check` reports a missing service in a layout's render or loaders with the layout file's `file:line`
- [ ] `pnpm turbo run test typecheck --filter=@sleekstack/ui-vite... --filter=@sleekstack/analyze --filter=sleekstack` green

## Acceptance
- [ ] TBD

## Done summary
`_layout.tsx` layouts are composed at generation. In `virtual:sleekstack/routes`, each page's `render` is wrapped in the layouts of its directory chain, outer first, with `(group)` layouts included. Its `loaders` are the layouts' loaders (outer first) followed by its own, each loader once by identity. `notFound` is not wrapped. A `_layout` under a `_` directory is ignored, a `_layout` with no default export fails naming the file, and two layouts in one directory fail naming both. The reasons (remount on navigation; `notFound` gets no layout because its loaders would never run) are documented in `moduleCode`; ADR 0050 already states both, so it was not edited (outside Touches).

`routes.gen.d.ts` types a page with layouts as `Page<typeof import("./x"), [typeof import("./_layout"), ...]>`, and the layouts' loaders join the page's `loaders` type, so `router()` infers their requirements. Pages without layouts keep `Page<typeof import("./x")>`.

`sleekstack check` reads the layout chain through the declaration. The page renders inside each layout's `children` (destructured `children` or `props.children`), so a layout `Provider` or `Boundary` covers it as at runtime. Layout loaders sit beside the page under the same `Route` provide. A layout's missing service is reported at the layout file's `file:line`. A per-page layout chain that differs from the files is reported naming the page and both chains.

Tests:
- `packages/ui-vite/src/__tests__/routes.test.ts`: nesting order with a group layout, loader dedupe, a layout guard redirecting the page below it through `handle`, `notFound` unwrapped, the `_lib/_layout` ignored, layout-loader type inference, and `_layout` with no default export.
- `packages/analyze/src/__tests__/components.test.ts` plus the `ui-router-file-routes` fixture: `(shop)/_layout` render and loaders missing Db at the layout file's lines, `(db)/_layout` providing Db to its page, the ignored `_lib/_layout`, and a stale per-page chain.

Follow-up: `apps/playground/ui/src/routes/routes.gen.d.ts` carries the old `Page<M>` alias until vite next rewrites it (task 8).

baseline: green (pnpm turbo run test typecheck --filter=@sleekstack/ui-vite... --filter=@sleekstack/analyze --filter=sleekstack)

Tier: implementer (project routing block: opus at medium)
stage: impl-review - ran (codex fan-out rid 0bd33fb124e54f1186ea15cf31d7e138: NEEDS_WORK, 2 findings (layout children scope, per-page chain check), fixed in 4c58d56f; re-review SHIP. An earlier fan-out, rid 9d9ee74b, was interrupted by machine sleep and refunded)
## Evidence
- Commits: cfbb72044bb56d279137b761aced9a0c49d19f5c, 4c58d56f3ac5583eedba1fee4349d93dfaf4eee9
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld
- PRs: