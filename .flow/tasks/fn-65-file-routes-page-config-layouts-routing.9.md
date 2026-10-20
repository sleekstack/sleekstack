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
TBD

## Evidence
- Commits:
- Tests:
- PRs:
