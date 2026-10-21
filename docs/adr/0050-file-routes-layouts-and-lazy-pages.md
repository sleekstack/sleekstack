# 0050. File routes: routing syntax, page config, layouts composed at generation, lazy pages

## Status

Accepted. Amends ADR 0036 (`:name?` and `*name` path segments; `Page` gains `load`) and ADR 0045 (the scan ignores `_` files; the declaration types each page from its route module). Built in spec fn-65.

## Context

`@sleekstack/ui-vite` turns the files under `routesDir` into a route table (ADR 0045), but a route file can only give a component. Apps still write their `pages` by hand beside the files, so loaders, fallbacks and prerender params live apart from the page. There are no layouts shared by a directory, no catch-all or optional segments, no way to keep a helper file next to a route, and every page lands in the main client bundle. `sleekstack check` reads only a `pages` object literal, so it cannot see file routes.

## Decision

- **Route-file conventions.** `[id]` is `:id`, `[[id]]` is the optional `:id?`, `[...rest]` is the splat `*rest`. Optional and splat are the last segment only; anywhere else the file fails with its path. A `(group)` directory adds no path segment but stays in the route name (the file path without extension), so names stay unique.
- **`_` is not a route.** A file or directory whose name starts with `_` is not scanned as a route: co-located components, helpers and tests live beside the routes. `_layout` files and a root `_notFound` are read for their own roles below. Under ADR 0045 a file `_x.tsx` was the route `/_x`; it no longer is.
- **Match order at one position:** static, then `:param`, then `:param?`, then `*splat`. Two files whose paths differ only in param names collide and fail naming both files. `users/index` beside `users/[[id]]` is not a collision: the paths differ and the static file wins for `/users`.
- **Router matching** (ADR 0036 amended): the table stays a const object of path strings. `:name?` as the last segment also matches the path without it; `*name` as the last segment matches one or more remaining segments, each percent-decoded and joined with `/`. `Params<'/files/*path'>` is `{ readonly path: string }`, `Params<'/u/:id?'>` is `{ readonly id?: string }`. Either one mid-path never matches. A hand-written table and a file table give the same types.
- **Page config.** A route file's default export is its component; named exports `loaders`, `fallback` and `prerender` are the rest of its `Page`. The module's `pages[name]` is a `Page`, so `router({ table, pages, notFound })` takes the module's exports and infers requirements as for a hand-written page. A root `_notFound` default export becomes `notFound`; with no such file the module has no `notFound` export.
- **Types stay in the declaration** (ADR 0045 kept types-only). `routes.gen.d.ts` types each page from its route module (`typeof import('./x')`), so the analyzer reads the component and loaders from one place. `sleekstack check` resolves a router built from `virtual:sleekstack/routes` through the declaration to the route modules; a hand-written literal keeps working.
- **Layouts are composed at generation, not in the router.** A `_layout` default export is a component taking `children`, with optional `loaders`. For each page the generated module wraps `render` in the layouts of its directory chain, outer first (a layout in a `(group)` applies inside the group), and gives the page the layouts' loaders (outer first) then its own, each loader once by identity. Two `_layout` files in one directory fail naming both, and a `_layout` under a `_` directory is ignored. `notFound` is not wrapped: the router runs no loaders for the not-found page, so a layout's loaders would never have run for it. Layouts remount on every navigation, as the whole page view is swapped today.
- **Lazy pages.** In the client environment `pages[name]` is only `{ load }`, which imports the route file and its layouts and gives the composed page; SSR and prerender import pages eagerly. The declaration types the loaded page with an optional `load`, so `Link`'s `code={pages[name].load}` typechecks on both sides. `Page` gains an optional `load`, and the router resolves a page's code before it reads `loaders` or `render`, including the first page before hydration. A module loads once and is shared by concurrent navigations; a rejected import, a `load` that throws synchronously, or a loaded module with no `render` fails that navigation with `LazyLoadError` at the nearest Boundary, and a later navigation tries again. The browser router starts listening for link clicks only after the first page's code is loaded and hydrated; until then a click is the browser's to follow.

## Consequences

- A route file is a whole page, and apps on file routes write no route table or `pages` by hand.
- `_`-prefixed files that were routes under ADR 0045 stop being routes; `pages[name]` is a `Page`, not the bare component.
- A layout cannot keep its state across sibling pages: that needs an outlet in the router, which is out of scope.
- The first visit to a lazy page loads its code, then its data. `Link`'s `code` prefetch with `pages.<name>.load` hides the waterfall.
- The router's `resolve` and the stale-loader rule (fn-64) are unchanged: layouts are part of one page view per navigation.
- `sleekstack check` depends on `routes.gen.d.ts` matching the files; a stale declaration fails the check naming what differs, and `vite` (dev) rewrites it.

## Rejected

- Layouts as nested routes with an outlet in the router: the router swaps whole pages and the fn-64 stale rule assumes one view per navigation; both would change.
- A generated runtime route module (a `.ts` file of imports) as the analyzer's input: ADR 0045 keeps generation types-only, and a literal file would drift from the route files.
- `loaders` in a separate eager file per lazy route: it forces a second file per route; prefetch hides the code-then-data waterfall.
- Next-style `[[...slug]]` optional catch-all: an `index` file beside a splat file says the same thing.
