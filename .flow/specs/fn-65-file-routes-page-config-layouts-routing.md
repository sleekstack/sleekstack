## Goal & Context
<!-- scope: business -->

`@sleekstack/ui-vite` already turns files under `routesDir` into a route table (fn-29, ADR 0045): `users/[id].tsx` is `/users/:id`, and `virtual:sleekstack/routes` exports `table` and `pages` (each file's default export). That is as far as it goes. A route file cannot say what a page loads, so the plugin's `pages` cannot be given to `router()`; `apps/playground/ui` and `apps/realworld` write the pages out by hand next to the files. There are no shared layouts, no catch-all or optional segments, no way to keep a helper file beside a route, and every page lands in the main bundle. `sleekstack check` reads only a `pages` object literal written in place, so it cannot see file routes at all.

After this spec a route file is a whole page: it exports its component, loaders, fallback and prerender params; a `_layout.tsx` wraps its directory; routes can be catch-all, optional or grouped; the client loads pages on demand; and `router({ table, pages, notFound })` takes the module's exports directly, with `sleekstack check` reading the route files. `apps/realworld` moves to `src/routes` as the proof on a real app (guards, loaders, params, forms).

## Architecture & Data Models
<!-- scope: technical -->

- **Route-file conventions** (`packages/ui-vite/src/routes.ts`, today `toRoute` / `scan` / `moduleCode` / `declaration`):
  - `[id]` is `:id`, `[[id]]` is the optional `:id?`, `[...rest]` is the splat `*rest`. Optional and splat are the last segment only; anywhere else the file fails with its path.
  - A `(group)` directory adds no path segment. It still takes part in the route name (the file path without extension), so names stay unique.
  - A file or directory whose name starts with `_` is not a route and is not scanned (co-located components, helpers, tests), except `_layout` and a root-level `_notFound`. This changes ADR 0045's scan (a file `_x.tsx` was the route `/_x`); the change goes in a new ADR 0050.
  - Match order at one position: static, then `:param`, then `:param?`, then `*splat`. Two files whose paths differ only in param names still collide and fail naming both files.
- **Router matching** (`packages/router/src/index.ts`, `match` and `Params`): the table stays a const object of path strings. `:name?` as the last pattern segment also matches the path without it; `*name` as the last segment matches one or more remaining segments, each percent-decoded and joined with `/` in `params.name`. `Params<'/files/*path'>` is `{ readonly path: string }`, `Params<'/u/:id?'>` is `{ readonly id?: string }`. A pattern with `?` or `*` anywhere but last never matches. A hand-written table and a file table give the same types (ADR 0036).
- **Page config.** A route file's default export stays its component. Named exports `loaders`, `fallback` and `prerender` are the rest of a `Page`. The module's `pages[name]` is a `Page` (`render: () => jsx(Default, {})`, plus those exports), so `router({ table, pages, notFound })` accepts it and infers its requirements as for a hand-written page. A root `_notFound.tsx` default export becomes `notFound`. The generated code uses `jsx` from `@sleekstack/ui/jsx-runtime`, as the router's `view` does.
- **Types stay in the declaration** (ADR 0045: types-only, no generated runtime file). `routes.gen.d.ts` types each page from its route module (`typeof import('./x')`) instead of its default export alone, so `PageNeeds` and the analyzer read loaders and the component from one place.
- **Analyzer.** `routerOf` / `routerRoot` in `packages/analyze/src/components.ts` read a router whose `pages` and `notFound` come from `virtual:sleekstack/routes`: they resolve the import through the declaration to each route module and build the same nodes as for a literal (render component, loaders requirements, `Route` provided), plus layouts. A hand-written literal keeps working.
- **Layouts are composed at generation, not in the router.** `_layout.tsx` default export is a component taking `children`; its optional `loaders` export is merged. For each page the module wraps `render` in the layouts of its directory chain, outer first (a `(group)` layout applies inside its group). The page's `loaders` are the layouts' (outer first) then its own, each loader once by identity (loader keys are loader key plus pathname, so a shared loader is held once). `notFound` is not wrapped: the router runs no loaders for it. Router, `resolve` and the fn-64 stale rule are unchanged.
- **Layouts remount on every navigation**, as the whole page view is swapped today. A layout that keeps its state across sibling pages needs an outlet in the router and is out of scope.
- **Lazy pages.** In the client environment the generated `pages[name]` carries `load: () => import(file)` and no `render` / `loaders` until loaded; in SSR (and so prerender) pages are imported eagerly. `Page` gains an optional `load` and the router resolves a page's code before it reads `loaders` or `render` (`resolve`, `history.ts`, `server.ts`, and the first page before hydration). The module loads once and is shared by concurrent navigations; a rejected import fails the navigation to a `LazyLoadError`-style failure at the nearest Boundary, as `lazy` in `@sleekstack/ui` does. Code, then data is a waterfall on the first visit; `Link`'s `code` prefetch hides it, and apps pass `pages.<name>.load` there. `Link` itself does not change.

## API Contracts
<!-- scope: technical -->

- Router (`@sleekstack/router`): `match` and `Params` accept `:name?` and `*name`; `Page` gets optional `load`. No other signature changes.
- ui-vite: `virtual:sleekstack/routes` exports `table`, `pages` (now `Page`-shaped) and `notFound` (only when `_notFound` exists). The `routes()` options stay as they are.
- Route file: default export component, optional `loaders`, `fallback`, `prerender`. Layout file: default export component with `children`, optional `loaders`.
- Behavior changes for existing file-route apps: `_`-prefixed files are no longer routes; `pages[name]` is a `Page` rather than the bare component. `apps/playground/ui` is the only app on file routes today and moves in this spec.
- Docs and decisions: ADR 0050 (amends 0036 and 0045), `packages/ui-vite/README.md`, `packages/router/README.md`, `apps/docs/content/docs/vite.mdx` and `routing.mdx`.

## Edge Cases & Constraints
<!-- scope: technical -->

- **Splat and root.** `*rest` needs at least one segment, so `/files` does not match `files/[...path]`; an `index` file next to it covers `/files`. A splat route is never preferred over a more specific one at the same position.
- **Optional param.** `users/[[id]]` matches `/users` and `/users/7`; with `users/index.tsx` also present the static file wins for `/users` (no collision error, different paths). `[[id]]` and `[id]` give the same shape plus one and are both allowed; the order rule decides.
- **Encoded paths.** Splat segments are decoded per segment, so `%2F` stays inside one segment and joins as `a%2Fb`'s decoded `a/b`; a malformed escape matches nothing, as today.
- **Invalid files fail with the file's path:** a bad segment, a misplaced optional or splat, two files with one path, a `_layout` or `_notFound` with no default export. An invalid file leaves the previous declaration in place (ADR 0045).
- **Layout loaders redirect or fail:** they run with the page's, concurrently, under the router's existing rules; a layout guard that redirects redirects for every page below it.
- **Dev:** adding, removing or renaming a route, layout or `_notFound` file rebuilds the module and declaration and reloads; editing a file does not need a rebuild (HMR as today).
- **Hydration:** the first page's module is loaded before `startRouter` hydrates, so lazy loading never mismatches server markup.
- **Bundle:** client chunks of a lazy page carry only that page; the SSR bundle holds every page.
- Analyzer reads the declaration, never the generated virtual code; if the declaration and the files disagree the analyzer reports it, it does not guess.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** `match` and `Params` support `:name?` (last segment) and `*name` (last segment): matched paths, decoded params, types, and a pattern with either mid-path never matches. Errors: malformed escapes match nothing; `*name` does not match zero segments; precedence between hand-written patterns is table order, as today.
- **R2:** Route files support `[[id]]`, `[...rest]`, `(group)` and the `_` ignore rule, with static > param > optional > splat order and collision detection. Errors: a misplaced optional or splat, a bad segment and two files with one path fail naming the files; an ignored file never reaches the table, imports or declaration.
- **R3:** A route file's `loaders`, `fallback` and `prerender` exports and a root `_notFound` reach `pages` and `notFound` so `router({ table, pages, notFound })` typechecks and infers requirements like a hand-written router; `routes.gen.d.ts` stays types-only. Errors: a `_notFound` or route file with no default export fails naming the file; with no `_notFound` the module has no `notFound` export and importing it is a type error.
- **R4:** `sleekstack check` reads a router built from `virtual:sleekstack/routes` and reports a missing service of a route file's render or loaders as for a literal router. Errors: a declaration that disagrees with the files is reported, not guessed; a hand-written router literal still checks as before.
- **R5:** `_layout.tsx` wraps its directory's pages (groups included), its `loaders` merge outer-first with each loader once, `notFound` is not wrapped, and layouts remount on navigation (documented). Errors: a layout loader that redirects redirects every page below it; a layout with no default export fails naming the file; a layout in an ignored `_` directory is not applied.
- **R6:** In the client build a route's page code loads on first navigation or prefetch, once, shared across concurrent navigations; SSR and prerender import eagerly; the first page loads before hydration. Errors: a failed import fails that navigation with a typed failure at the nearest Boundary and a later navigation to it tries again; an interrupted navigation does not cancel a load another one shares.
- **R7:** `apps/playground/ui` and `apps/realworld` run on the new conventions with no hand-written `pages` or route table; realworld's existing tests pass unchanged, and ADR 0050 and the docs state the conventions. Errors: none beyond R1-R6.

## Early proof point
<!-- scope: technical -->

Task fn-65-file-routes-page-config-layouts-routing.4 validates the riskiest unknown: `sleekstack check` reading file routes through the declaration. If the analyzer cannot resolve route modules from `routes.gen.d.ts`, re-evaluate before tasks 5-9: either a larger declaration, or ADR 0050 allowing a generated runtime module (which ADR 0045 rejects today) that the analyzer can read as a literal.

## Quick commands
<!-- scope: technical -->

`pnpm turbo run test typecheck --filter=@sleekstack/router... --filter=@sleekstack/ui-vite... --filter=@sleekstack/analyze --filter=sleekstack --filter=realworld`

## Boundaries
<!-- scope: business -->

Out of scope: layouts that keep state across navigation (an outlet in the router), per-route error-boundary files, per-route middleware, search-param schemas and route masking, an `href()` builder from a table, changes to `Link` beyond using `pages.<name>.load`, content sites (`sleekContent`, ADR 0047), and any change to `handle` beyond awaiting a page's code.

## Decision Context
<!-- scope: both -->

Chosen by the user: cover config, layouts and routing syntax (the largest option), and move RealWorld last. Layouts are composed in the generated module because the router already swaps whole pages and the fn-64 stale rule assumes one view per navigation; an outlet would change both. Rejected a generated runtime route module (a `.ts` file of imports) as the analyzer's input: ADR 0045 keeps generation types-only and a literal file would drift from the files. Rejected splitting `loaders` into a separate eager file for lazy pages: it forces a second file per route; the code-then-data waterfall is hidden by `Link` prefetch. Rejected Next-style `[[...slug]]` optional catch-all: `index` plus a splat file says the same thing.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
| --- | --- | --- | --- |
| R1 | match and Params support `:name?` and `*name` last-segment patterns | fn-65-file-routes-page-config-layouts-routing.1 | — |
| R2 | Route files: `[[id]]`, `[...rest]`, `(group)`, `_` ignore, order and collisions | fn-65-file-routes-page-config-layouts-routing.2 | — |
| R3 | Page config exports and `_notFound` reach `pages` / `notFound`; declaration stays types-only | fn-65-file-routes-page-config-layouts-routing.3 | — |
| R4 | `sleekstack check` reads file routes | fn-65-file-routes-page-config-layouts-routing.4 | — |
| R5 | Layouts | fn-65-file-routes-page-config-layouts-routing.5 | — |
| R6 | Lazy pages | fn-65-file-routes-page-config-layouts-routing.6, fn-65-file-routes-page-config-layouts-routing.7 | — |
| R7 | playground and realworld on the new conventions; ADR 0050 and docs | fn-65-file-routes-page-config-layouts-routing.8, fn-65-file-routes-page-config-layouts-routing.9 | — |
