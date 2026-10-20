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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
