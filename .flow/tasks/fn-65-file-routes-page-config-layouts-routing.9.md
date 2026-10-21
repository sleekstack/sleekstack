---
satisfies: [R7]
---
# fn-65-file-routes-page-config-layouts-routing.9 realworld moves to src/routes

Touches: apps/realworld/src, apps/realworld/vite.config.ts, apps/realworld/package.json, apps/realworld/tsconfig.json, apps/realworld/README.md

## Description
Move RealWorld to file routes: pages under `src/routes`, the header and footer as the root `_layout.tsx` (with the `viewer` loader), guarded pages through a `(guarded)` group layout that adds the `signedIn` loader, `_notFound.tsx`, and `app.tsx` reduced to `router({ table, pages, notFound })` from the module. No behavior change; the existing tests pass unchanged.

**Size:** M
**Files:** `apps/realworld/src/app.tsx`, `apps/realworld/src/pages/*` (moved to `src/routes`, shared loaders and components stay as helpers under `_` names or `pages/`), `apps/realworld/vite.config.ts`, `apps/realworld/package.json`, `tsconfig.json`, `README.md`

### Approach
- Today `src/app.tsx` writes a `pages` literal of 11 routes with `open = [viewer]` and `guarded = [viewer, signedIn]` lists, and `pages/routes.ts` holds a hand-written `table` (`home`, `feed`, `tag/:tag`, `login`, `register`, `settings`, `editor`, `editor/:slug`, `article/:slug`, `profile/:username`, `profile/:username/favorites`). `pages/layout.tsx` renders the header, footer, `viewer` and `signedIn`; `pages/loaders.ts` holds shared route loaders that `Link`s prefetch.
- The app does not use the `sleekstack()` plugin: `vite.config.ts` has a custom `realworld:start` plugin and the vitest config. Add the `routes()` plugin (from `@sleekstack/ui-vite`, new workspace dep) there so vitest, `vite dev` and `vite build` serve `virtual:sleekstack/routes`; commit `routes.gen.d.ts` (the app's `tsc` and `sleekstack check` run without Vite). `sleekstack check` reads the routes through task 4.
- `Link` needs `table` (now from the virtual module) and prefetch `loaders`: keep passing the shared loaders; use `code={pages.<name>.load}` where it matters. `route names` change to file paths: update every `Link`/`href` that uses a name.
- The existing tests drive real SSR and hydration (`test/auth.test.ts`, `feed.test.ts`, `article.test.ts`) and `architecture.test.ts` guards the client boundary and the client chunk's server-only strings; they must pass unchanged. The logout-lands-on-`/` case depends on fn-64 and must still pass.
- Update `README.md` and `docs/adr/0042` only if the app layout described there changes.

### Investigation targets
**Required**:
- `apps/realworld/src/app.tsx`, `src/pages/*.tsx`, `src/pages/routes.ts`, `vite.config.ts`, `package.json`
- `apps/realworld/test/architecture.test.ts`, `test/auth.test.ts`, `test/feed.test.ts`

### Acceptance
- [ ] No hand-written route table or pages literal in `apps/realworld`; `app.tsx` builds the router from `virtual:sleekstack/routes`
- [ ] Header, footer and guards come from layouts; every page behaves as before (the existing tests pass unchanged)
- [ ] `pnpm turbo run test typecheck build --filter=realworld` and `pnpm --filter realworld check` green; `pnpm format:check` clean

## Acceptance
- [ ] TBD

## Done summary
`apps/realworld` now runs on file routes under `src/routes`. `app.tsx` is `router({ table, pages: routePages, notFound })` from `virtual:sleekstack/routes`, and `pages/routes.ts` and the pages literal are gone. The root `_layout.tsx` renders the header and footer and declares `viewer`. The `(guarded)` group layout adds `signedIn` (feed, settings, editor, editor/[slug]). `_notFound.tsx` is the 404 page. Screens that several routes share are `_` helpers: `_home`, `_auth`, `_footer`, `_links`, `profile/_profile` and `(guarded)/editor/_editor`. `src/pages` keeps the shared loaders (`viewer` and `signedIn` now live in `loaders.ts`), `functions.ts` (unchanged), `form.tsx` and the new `field.tsx`. `routes.gen.d.ts` is committed. `vite.config.ts` adds the routes plugin, and `@sleekstack/ui-vite` is a new devDependency (only the realworld hunk of `pnpm-lock.yaml` is committed). The README describes the new layout. ADR 0042 did not describe the pages layout, so it is unchanged.

Every page keeps its loader set: layout loaders come first, so the result is `[viewer, signedIn, ...page]` as before. The tag loader reads `Route` params, as `slug` and `username` already did, instead of `params(table, 'tag')`. Fix from review: page-body links pass `code` (the page's `load`) beside their loaders through `routes/_links.ts`. To do that, `PreviewLinks` in `modules/articles/presentation/preview.tsx` now takes `{ loaders, code? }` per target.

Architecture test edited (granted by the conductor). Exact changes:
1. A new `routes/` rule. Local: `routes/`, `pages/`, `errors`. Packages: the pages list plus `virtual:sleekstack/routes` and `@sleekstack/ui/jsx-runtime`. The jsx-runtime entry is needed because the generated `routes.gen.d.ts` under `src/routes` has `import('@sleekstack/ui/jsx-runtime')`.
2. The `app` rule's packages add `virtual:sleekstack/routes`. `routes/` was not added to app's local list because app does not import it.
3. The module-index check lets `routes/` import modules through their `index`, as `pages/` does.
4. The chunk-build `build()` gets `plugins: [routes()]`, imported from `../vite.config`.
The header comment also describes `routes/` and `pages/`. No other check changed. The client-boundary test and the server-only-strings test are as before.

Deviations:
- `@sleekstack/ui-vite` exports only `sleekstack()`, not `routes`. `vite.config.ts` therefore exports `routes = () => sleekstack().filter((p) => p.name === 'sleekstack:routes')`. Follow-up: export `routes` from `@sleekstack/ui-vite`.
- Edited outside the listed files: `modules/articles/presentation/preview.tsx`, for the review fix. It is under `apps/realworld/src`, which is in Touches.

Known pitfall: route files and `_` helpers import `virtual:sleekstack/routes`, and SSR imports them from inside it. Read `table` and `pages` only inside functions, never at module top level. Recorded in memory as `lazy-file-routes-links-need-code-2026-10-21`.

Header and footer links still pass neither loaders nor code, as before. Not a regression.

baseline: green (spec Quick command, rc=0)
Gates: spec Quick command green after the fix (the final run was a full turbo cache hit, on the same inputs as the post-fix `pnpm turbo run test typecheck build --filter=realworld` run: 12 files, 155 tests passed). `pnpm --filter realworld check` green, and it lists every route file. `pnpm format:check` clean.

Tier: implementer (project routing block: opus at medium)
stage: impl-review - ran (codex fan-out rid ebe910dab8b64d33967c0ec36412ad64: correctness NEEDS_WORK (1 finding: links lacked code prefetch), contracts SHIP, integration SHIP; fixed in bb8985fc; re-review SHIP). The correctness draw landed this round.
## Evidence
- Commits: 68584eb2265ff8d3df48c30bad4cab04ce6446c5, bb8985fc0c430754abdf7c6d7552b029b4d3a0d3
- Tests: pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld, pnpm turbo run test typecheck build --filter=realworld, pnpm --filter realworld check, pnpm format:check
- PRs: