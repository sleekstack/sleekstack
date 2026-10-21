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
In the client environment (`consumer === 'client'`), `virtual:sleekstack/routes` now gives each page only `{ load }`. `load` dynamic-imports the route file and its layouts, then builds the same Page as before (layouts composed, loaders merged), so the entry has no static route import. SSR, and so prerender, keeps the eager static imports. `routes.gen.d.ts` types an optional `load?: () => Promise<unknown>`, which is what `Link`'s `code` prop takes. `apps/playground/ui/src/app.tsx` passes the module's `pages` straight to `router()`.

The playground build now emits a separate chunk per route. The built client hydrates `/`, then a link click loads the `users/[id]` chunk on demand and renders `User 42`. The prerendered `index.html` and `users/42/index.html` are byte-identical to the pre-change build once asset hashes are normalized.

Baseline was red before any edit: `sleekstack-playground#test` failed with "count 0" vs "count 1". Cause: Vite drops the client entry's `started` export in app builds, so the test never awaited hydration and passed only because hydration used to run synchronously. Task 6's awaited first-page load made the race visible. Fix: `apps/playground/ui/vite.config.ts` sets `preserveEntrySignatures: 'exports-only'` on the client, and the test now disposes its router and resets the location between cases.

Deviation: `apps/playground/src/__tests__/ui-example.test.ts` is outside the declared Touches (`apps/playground/ui`). It is the playground's only build test, and the task's navigation acceptance and the red baseline both live there.

Tests:
- `packages/ui-vite/src/__tests__/routes.test.ts`: "gives each client page only a load that imports its file and layouts; SSR imports them eagerly" (client code from the client plugin container, run and loaded), plus a `load` type assertion.
- `apps/playground/src/__tests__/ui-example.test.ts`: one chunk per route, outside the entry; navigation to `/users/42` loads its chunk.

baseline: red (sleekstack-playground#test, pre-existing from task 6 hydration timing; fixed in this task)
Gates: `pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite... --filter=sleekstack-playground` green; spec Quick command green. Gate receipt not written (NO_RECEIPT: the unrelated dirty pnpm-lock.yaml).

Tier: implementer (project routing block: opus at medium)
stage: impl-review - ran (codex fan-out rid c062a64c13e64f6fa6db6fcd19431bec: contracts SHIP, integration SHIP, correctness draw failed on model capacity; finalized SHIP)
## Evidence
- Commits: 25444b8be6fa02bc54e54b97b6b8816e2c7940ac
- Tests: pnpm turbo run test typecheck build --filter=@sleekstack/ui-vite... --filter=sleekstack-playground, pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld
- PRs: