# @sleekstack/ui-vite

The SleekStack Vite plugin. It covers ui JSX, `sleekstack check` diagnostics, stable component ids, file-based routes for `@sleekstack/router`, and client and SSR bundles. It is a plugin, not a meta-framework.

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sleekstack } from '@sleekstack/ui-vite'

export default defineConfig({
  plugins: [
    react(), // only when the app has React guests
    sleekstack({
      include: 'src/ui/**/*.tsx', // React guests live outside this glob
      entries: { client: 'src/entry-client.ts', server: 'src/entry-server.ts' },
    }),
  ],
})
```

`apps/playground/ui` is a working example: a router app rendered to a string by `handle`, prerendered by `vite build` (`prerender: true`) and hydrated by `startRouter`.

## Options

`sleekstack(options?)` returns an array of plugins. Every option is optional.

| Option                | Default      | What it does                                                                                                                                                                                                                                   |
| --------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `include` / `exclude` | none         | Globs (relative to the Vite root) or regexes of `.jsx` / `.tsx` files that are ui JSX without the pragma. A file that already names a `@jsxImportSource` keeps it.                                                                             |
| `routesDir`           | `src/routes` | Directory of route files, relative to the Vite root. Serves `virtual:sleekstack/routes`.                                                                                                                                                       |
| `entries`             | none         | `{ client, server }`, paths relative to the Vite root. `vite build` writes `dist/client` and `dist/server`, and the dev server answers every request through `server`. Without it, the plugin builds and serves the app as Vite normally does. |

## JSX and the pragma rule

ui JSX is opt-in per file (ADR 0015). The plugin sets no global `jsxImportSource`:

- A file with `/** @jsxImportSource @sleekstack/ui */` compiles against `@sleekstack/ui/jsx-runtime`. Put the pragma on line 1. Vite 8's Oxc transform reads it only in the comments before the first statement; after an `import` it is plain text and the file compiles as React JSX.
- A file matched by `include` (and not by `exclude`) gets the pragma added at the start of line 1.
- Any other file keeps the default, which is React JSX from `@vitejs/plugin-react` for guest files. Pragma'd ui files and React guest files can sit side by side in one app.

## Analyzer diagnostics

The plugin runs `@sleekstack/analyze` (the `sleekstack check` passes) over the Vite root's `tsconfig.json`.

- **Build:** the analyzer always runs, and an analyzer error fails the build with `file:line`.
- **Dev:** the analyzer runs after source changes, with a debounce. Errors show in Vite's error overlay with the `file:line` of the first, and the overlay clears when a run comes back clean.
- **Crashes:** a crash inside the analyzer is logged, and shown in the overlay in dev. It never throws out of the plugin or stops the dev server.

The analyzer is loaded through jiti on first use, and a run is synchronous whole-program TypeScript, so the dev server stops answering requests while a run lasts.

The analyzer reads router `pages` written as an object literal, or imported from `virtual:sleekstack/routes`. For the module's `pages` it reads `routes.gen.d.ts` to find each route file, then checks the file's default export and `loaders` like a page written in place, and reports a missing service at the route file's `file:line`. The module's `notFound` is read the same way: the declaration types it from the root `_notFound` file's module. A declaration that names a missing file or misses a route file is reported, never guessed: run `vite` to rewrite it.

## Stable component ids

Each function that a ui JSX file exports gets the id `<path from the Vite root, no extension>#<export name>`. `fnId` in `@sleekstack/ui` uses that id instead of its load-order counter, and HMR (fn-31) depends on it.

- The id is set where the function is declared. A re-export keeps the source module's id, and so does a re-evaluation of the same module.
- Two files that would give the same id, such as `a.tsx` and `a.jsx` both exporting `A`, fail the build.
- Only functions written in the export get an id: a declaration, an arrow function or a function expression. Any other export, such as `export const A = wrap(B)`, keeps `fnId`'s counter. Without the plugin, every component uses the counter.

## File-based routes

Files under `routesDir` become a `@sleekstack/router` app (ADR 0045, ADR 0050). A file's path without its extension is its route name, and its segments give the path:

| File segment      | Path segment             | Example                                                                  |
| ----------------- | ------------------------ | ------------------------------------------------------------------------ |
| `users`           | `users`                  | `users/index.tsx` is `/users`; an `index` file is its directory's path   |
| `[id]`            | `:id`                    | `users/[id].tsx` is `/users/:id`                                         |
| `[[page]]`        | `:page?`                 | `posts/[[page]].tsx` matches `/posts` and `/posts/2` (last segment only) |
| `[...slug]`       | `*slug`                  | `guide/[...slug].tsx` matches `/guide/a/b`, not `/guide` (last only)     |
| `(group)`         | nothing                  | `(docs)/guide/[...slug].tsx` is still `/guide/*slug`                     |
| `_name` (any `_`) | not a route, not scanned | `_counter.tsx`, `_lib/`: helpers, components and tests beside the routes |

At one position a static segment matches first, then `:param`, then `:param?`, then `*splat`. Two files whose paths differ only in param names fail naming both; `users/index` beside `users/[[id]]` is fine, and the static file wins for `/users`. A bad segment, an optional or splat segment that is not the last, or a file with no default export fails with the file's path.

A route file is a whole page. Its default export is the component; the named exports `loaders`, `fallback` and `prerender` are the rest of its router `Page`:

```tsx
// src/routes/users/[id].tsx
import { useLoader } from '@sleekstack/router'
import { user } from './_loaders' // a `_` file: not a route

export const loaders = [user]
export const fallback = 'Loading'
export const prerender = async () => [{ id: '42' }]
export default function* User() {
  const u = yield* useLoader(user)
  return <h1>{u.name}</h1>
}
```

`virtual:sleekstack/routes` exports `table` (route name to path string; params are inferred from the strings as in a hand-written table, ADR 0036), `pages` (route name to `Page`) and, only when a root `_notFound` file exists, `notFound` rendering its default export. The app passes them straight to the router, and `sleekstack check` reads that router as it reads a literal one:

```tsx
import { router } from '@sleekstack/router'
import { notFound, pages, table } from 'virtual:sleekstack/routes'

export const app = router({ table, pages, notFound })
```

**Layouts.** A `_layout` file's default export is a component taking `children`; it wraps every page in its directory and below, outer layouts first, and a layout in a `(group)` applies only inside the group. A layout's optional `loaders` export joins the page's: the layouts' loaders (outer first), then the page's own, each loader once. A layout loader that redirects redirects every page below it. The layouts are composed when the module is generated, not by the router, so they remount on every navigation as the page does; a layout that keeps state across sibling pages is not supported. `notFound` gets no layout: the router runs no loaders for the not-found page, so a layout's loaders would never have run for it. A `_layout` inside a `_` directory is ignored.

**Lazy pages.** In the client build each page is only `{ load }`, importing its route file and its layouts, so each route is its own chunk. The router loads a page's code once, before its loaders run or it renders, and before hydrating the first page; concurrent navigations share the load, and a failed one renders a `LazyLoadError` at the nearest `Boundary` and is tried again on the next navigation. SSR and prerender import every page eagerly. The first visit to a page loads its code, then its data; `Link`'s `code` prefetches the code on hover or focus:

```tsx
<Link href="/users/42" table={table} code={pages['users/[id]'].load}>
  User 42
</Link>
```

`load` is typed as optional, because the server's pages have none; `Link` takes `code` as optional too.

In dev, adding, removing or renaming a route, layout or `_notFound` file rebuilds the module and reloads the page without a restart; editing one is an ordinary hot update.

The plugin writes `routes.gen.d.ts` into `routesDir` (ADR 0045). The file only declares the module's types: literal paths, each page typed from its route module and its layouts' modules, and `notFound` when there is one. It is rewritten when the dev server starts and when route files are added or removed. An app may commit the file or gitignore it. If it is gitignored, run `vite` once before a plain `tsc` or `vite build`: the analyzer reads the declaration, and a declaration that disagrees with the route files is reported, never guessed.

## Client and SSR entries

With `entries`, `vite build` first builds the client environment into `dist/client`, then the `ssr` environment into `dist/server`. The server entry's default export answers a request:

```ts
import { handle } from '@sleekstack/router'
import { scripts } from 'virtual:sleekstack/client'
import { app } from './app'

const document = {
  before: `<!doctype html><html><head><meta charset="utf-8">${scripts}</head><body><div id="app">`,
  after: '</div></body></html>',
}

export default (request: Request): Promise<Response> => handle(app, request, { stream: true, document })
```

`virtual:sleekstack/client` exports `scripts`, the markup for the document head. In a build, it loads the built client chunk and every CSS file of the chunk's static import graph, or every emitted CSS file when `cssCodeSplit` is off. In dev, it contains the tags Vite's HTML transforms add (including plugin-react's refresh preamble) and loads the source client entry with HMR.

Unlike `virtual:sleekstack/routes`, this module has no generated declaration. Add one to the app, as `apps/playground/ui/src/env.d.ts` does:

```ts
declare module 'virtual:sleekstack/client' {
  /** Markup that loads the client entry, for the document head. */
  export const scripts: string
}
```

`vite build --watch` is not supported with `entries` and fails with a clear error.

## Prerendering: `prerender`

`sleekstack({ entries, prerender })` makes `vite build` write static HTML for router pages. It is a build mode over the SSR path: after the client and server builds, the plugin requests each path from the built server entry and writes the response to the client output.

- `prerender: true` prerenders every static route. `prerender: ['/', '/about']` prerenders the listed paths. Off (the default) prerenders nothing.
- A dynamic route (`/users/:id`, `/posts/:page?`, `/guide/*slug`) is prerendered from its page's `prerender()`, which returns one params object per page: an optional param left out gives the path without it, and a splat takes a `/`-joined value (`{ slug: 'a/b' }`). The paths from the option and from every `prerender()` are merged as a union. A dynamic route that has no `prerender()` and no listed path is skipped with a warning.
- Trailing slash: paths are normalized without one (`/docs/` is `/docs`, the root is `/`), and each page is written to `<path>/index.html`. A static file server therefore answers both `/docs` and `/docs/`.
- A loader or render error, a response other than 200, or an error reported to `onError` fails the build, naming the route.

```tsx
// src/routes/users/[id].tsx, or `prerender` on a hand-written page
export const prerender = async () => [{ id: '42' }]
```

The server entry must export its router as `router` and take `(request, { onError })`, passing `onError` on to `handle`. For the page's `<Head>` tags to appear in the written head, render to a string (no `stream`) and give `document.before` a function of the head:

```ts
// entry-server.ts
import type { Cause } from 'effect'
import { handle } from '@sleekstack/router'
import { scripts } from 'virtual:sleekstack/client'
import { app } from './app'

export const router = app

const document = {
  before: (head: string) =>
    `<!doctype html><html><head><meta charset="utf-8">${head}${scripts}</head><body><div id="app">`,
  after: '</div></body></html>',
}

export default (request: Request, context?: { onError: (cause: Cause.Cause<unknown>) => void }) =>
  handle(app, request, { document, onError: context?.onError })
```

Loaders run at build time, and their data rides the hydration payload as it does in SSR, so the client entry's `startRouter` hydrates a prerendered page. `apps/playground/ui` prerenders a path list plus `users/[id]`'s `prerender()`; its test serves `dist/client` from a plain static file server and hydrates the home page.

## Content sites: `sleekContent`

`sleekContent(options)` is a second, separate plugin for documentation-style sites built from a tree of `.md` / `.mdx` pages (ADR 0047). Use it beside `sleekstack()`; it does not replace it. MDX pages compile straight to JavaScript against `@sleekstack/ui/jsx-runtime`, so they need neither the pragma nor `include`.

Exports: `@sleekstack/ui-vite` (`sleekContent`, `compileMdx`, `createStyleSheet`, `assertLinks`, `findBrokenLinks`, `headingIds`, `headings`, `rebaseLink`, `scanPages`, `contentRouteTable`, `buildSearchIndex`, `searchEntries`, and the search client), `@sleekstack/ui-vite/search-client` and `@sleekstack/ui-vite/og-meta` (both browser-safe), and `@sleekstack/ui-vite/links` and `@sleekstack/ui-vite/content-routes` (Node-only, for scripts that check content links without loading the plugin).

Options: `content` (directory, resolved against the cwd), `base?`, `contentBase?` (the prefix the content's own links are written with, default `/docs`; rewritten to `base`, so the same content builds under any prefix), `app`, `prerender?: { server, client }`, `search?` (`false` turns the index off), `og?: { site, fonts }`. The frontmatter parser reads simple `key: value` lines only. `ui` and `effect` are peer dependencies; the virtual-module types (`virtual:sleek-content`) are not shipped. Void elements and `<Head>` come from `@sleekstack/ui` (ADR 0046, ADR 0044).

`compileMdx` turns an MDX page into a module that exports its component and `frontmatter`, using the ui JSX runtime.

- `<include>path</include>` expands to a code block read from the file (path relative to the page).
- Code fences are highlighted at build time with shiki (light and dark). Highlighter inline styles become classes; `createStyleSheet().css()` is the one stylesheet for all pages.
- Headings get ids; tables, links and lists are GitHub-flavored markdown.
- Errors read `file:line: reason`, including an unknown fence language and a missing include file.

### Routes, links and the dev entry

`sleekContent({ content, base?, app })` is the Vite plugin. `virtual:sleek-content` exports `routes` (a `@sleekstack/router` table from the content tree and its `meta.json` order, with `base` prefixed) and `pages` (route name to the compiled page loader); `virtual:sleek-content.css` is the highlighting stylesheet. In dev, a page route and `/_sleek/*` go to the `start` fetch handler exported as `app` by the `app` module; a page added, renamed or removed updates the table without a restart, and a content error shows in the overlay until the next good save. The build fails on a broken internal link or anchor (`assertLinks`, `findBrokenLinks`).

### Static build and search

`sleekContent({ ..., prerender: { server, client }, search? })` makes `vite build` write the whole site:

- `client` is the browser entry (the build input). It hydrates `#app` with `hydrateMount`; it must not import `virtual:sleek-content.css`, the plugin writes `assets/sleek-content.css` itself and links it.
- `server` is a module exporting `render(path)`, returning `{ app, layer }` for a route (see `RenderEntry`). The build calls it for every page, renders with `renderToString`, waits for `onHead`, and writes `<route>/index.html` (`/` is `index.html`) with the head tags, the stylesheet and the client script. A page that fails to compile or render fails the build as `prerender /route: reason`. When `base` moves the index page off `/`, a root `index.html` redirects to it.
- Output is plain files and needs no server logic; it never imports `@sleekstack/start`.
- `search-index.json` is written at the end unless `search: false`; the build logs its size. The stylesheet is written last, after every page compiled.

#### Search client

`@sleekstack/ui-vite/search-client` (source `src/search-client.ts`) has no Node imports and is safe in the browser:

```ts
type SearchEntry = { title: string; heading: string; anchor: string; text: string }
type SearchIndex = { version: 1; entries: SearchEntry[] }
type SearchResult = { title: string; heading: string; anchor: string; snippet: string; score: number }

search(index: SearchIndex | null | undefined, query: string, limit = 20): SearchResult[]
loadSearchIndex(url: string, fetcher = fetch): Promise<SearchIndex>
class SearchIndexMissing extends Error
```

`search` ranks by score (title hit 10, heading 5, text 1, per term; every term must hit). `anchor` is the section URL, `/guide/a#configuration`. An empty query returns `[]`; a missing or malformed index throws `SearchIndexMissing`, as does `loadSearchIndex` on a failed request or bad body.

### Open Graph images

`sleekContent({ ..., og: { site, fonts: [{ name, file, weight? }] } })` writes one 1200 by 630 PNG per page at `og/<name>.png` (`og/index.png` for the root) from the page's frontmatter `title` and `description`, rendered with satori and `@resvg/resvg-js`. Font files (TTF, OTF, WOFF; paths relative to the project root) are read at build; a missing file or an empty `site` fails the build. `og` absent or `false` writes no image.

The tags come from the page's own `<Head>`: `@sleekstack/ui-vite/og-meta` (no Node imports, safe in the browser entry) exports `ogMeta({ site, path, name, title, description?, base?, image? })`, the `og:*` and `twitter:card` props with an absolute `og:image`:

```tsx
<Head>
  {ogMeta({ site, path, name, title }).map((t) => (
    <meta {...t} />
  ))}
</Head>
```

`image: false` (images off) drops every `og:image*` tag and sets `twitter:card` to `summary`. `ogMeta` throws on an empty `site`.

## Known limitations

- **Relative `base` with `entries`:** a relative `base` such as `./` is rejected, because a page at `/users/42` would request its client chunk from `/users/assets/...`. Use an absolute `base` (the default `/`, or a path such as `/app/`).
- No deploy adapters. HMR state preservation (the `hmr` option, see the Vite guide) and static site generation (`prerender`) are covered above. `sleekContent` prerenders content trees only.

## Vite API check (Vite 8.0.16)

Checked against the installed `vite@8.0.16` and `@vitejs/plugin-react@6.0.2`:

- Vite 8 bundles with Rolldown and transforms TS/JSX with Oxc (`vite:oxc`); esbuild is no longer the transformer. Oxc honours a per-file `@jsxImportSource` pragma only in the file's leading comments (a pragma after the first statement is ignored), so the plugin puts it at the start of line 1.
- plugin-react 6 is Babel-free: it sets `oxc.jsx` (automatic runtime, `importSource` only when given) plus Fast Refresh, and no longer transforms JSX itself. Its default `jsxImportSource` is `react`, which a file pragma overrides.
- Transform hooks take a `filter` (`transform: { filter: { id }, handler }`), which Rolldown applies before calling into JS; `createFilter(include, exclude, { resolve: root })` matches globs.
- The Environment API is available: per-environment config under `environments` (`client`, `ssr`), `this.environment` in hooks, `applyToEnvironment` / `perEnvironmentPlugin` to scope a plugin, and `config.consumer` (`client` | `server`). `createBuilder` / `builder.buildApp` build all environments, and the client and SSR builds use them.
