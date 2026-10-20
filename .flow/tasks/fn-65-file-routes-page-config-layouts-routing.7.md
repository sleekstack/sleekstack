---
satisfies: [R6]
---
# fn-65-file-routes-page-config-layouts-routing.7 ui-vite: lazy page chunks in the client build, eager in SSR

Touches: packages/ui-vite/src/routes.ts, packages/ui-vite/src/__tests__/routes.test.ts, packages/ui-vite/src/__tests__/plugin.test.ts, apps/playground/ui

## Description
Generate `pages[name].load = () => import(file)` in the client environment (no `render` / `loaders` until loaded) and the eager form in SSR and prerender. Layouts load with their page.

**Size:** M
**Files:** `packages/ui-vite/src/routes.ts`, `packages/ui-vite/src/__tests__/routes.test.ts`, `packages/ui-vite/src/__tests__/plugin.test.ts`, `apps/playground/ui`

### Approach
- The `load` hook of the plugin knows the environment (Vite 8 environments: `this.environment.name`, as used by the `entries` build in `plugin.ts`; the plugin builds client then `ssr`). Emit the lazy shape for `client`, the eager shape (static imports, task 3 form) for `ssr`.
- Lazy shape: `load: () => import(route).then((m) => ({ render, loaders, fallback }))` where `render` and `loaders` already include the layout chain (task 5), so one chunk holds the page and its layouts. The declaration is unchanged; types describe the loaded page, `load` is optional on the type.
- The `prerender` export enumerates in SSR, where pages are eager: check `prerender/enumerate.ts` still sees it.
- Tests first: generated client code uses dynamic imports and no static route import; generated SSR code is eager; a real `vite build` of the playground produces a separate chunk per route (`plugin.test.ts` already runs builds: follow it); the built client navigates to a second page and loads its chunk; the prerendered HTML is the same as before.
- Update `apps/playground/ui` to use `pages` straight from the module with lazy chunks.

### Investigation targets
**Required**:
- `packages/ui-vite/src/routes.ts`, `packages/ui-vite/src/plugin.ts:80-140`, `packages/ui-vite/src/__tests__/plugin.test.ts`
- `packages/ui-vite/src/prerender/`

### Acceptance
- [ ] Client build: each route (with its layouts) is its own chunk, none is in the entry chunk; SSR build imports pages eagerly
- [ ] The playground navigates between pages in the built client, loading the second chunk on demand; prerender output unchanged
- [ ] `pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite... --filter=sleekstack-playground` green

## Acceptance
- [ ] TBD

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
