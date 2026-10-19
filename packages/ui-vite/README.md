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

`apps/playground/ui` is a working example: a router app streamed by `handle(..., { stream: true })` and hydrated by `startRouter`.

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

The analyzer reads router `pages` only as an object literal written in place. Write the pages out in the `router({ ... })` call, as the example's `app.tsx` does. Passing `pages` from `virtual:sleekstack/routes` hides them from the analyzer.

## Stable component ids

Each function that a ui JSX file exports gets the id `<path from the Vite root, no extension>#<export name>`. `fnId` in `@sleekstack/ui` uses that id instead of its load-order counter, and HMR (fn-31) depends on it.

- The id is set where the function is declared. A re-export keeps the source module's id, and so does a re-evaluation of the same module.
- Two files that would give the same id, such as `a.tsx` and `a.jsx` both exporting `A`, fail the build.
- Only functions written in the export get an id: a declaration, an arrow function or a function expression. Any other export, such as `export const A = wrap(B)`, keeps `fnId`'s counter. Without the plugin, every component uses the counter.

## File-based routes

Files under `routesDir` become a `@sleekstack/router` route table. `users/[id].tsx` gives the path `/users/:id`, and an `index` file gives its directory's path. A static segment matches before a param in the same position.

`virtual:sleekstack/routes` exports two objects keyed by route name, which is the file path without its extension:

- `table` maps each name to its path string. Params are inferred from the path strings, as in a hand-written table (ADR 0036).
- `pages` maps each name to the route file's default export.

In dev, adding or removing a route file rebuilds the module and reloads the page without a restart. A segment that is neither a name nor a `[param]` fails with the file's path, and so do two files that give the same path.

The plugin writes `routes.gen.d.ts` into `routesDir` (ADR 0045). The file only declares the module's types, with literal paths and each page's type, and it is rewritten on build start and when route files are added or removed. An app may commit the file or gitignore it. If it is gitignored, run `vite` or `vite build` once before a plain `tsc`.

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
- No HMR state preservation (fn-31), no static site generation for `sleekstack()` apps (fn-30) and no deploy adapters. `sleekContent` prerenders content trees only.

## Vite API check (Vite 8.0.16)

Checked against the installed `vite@8.0.16` and `@vitejs/plugin-react@6.0.2`:

- Vite 8 bundles with Rolldown and transforms TS/JSX with Oxc (`vite:oxc`); esbuild is no longer the transformer. Oxc honours a per-file `@jsxImportSource` pragma only in the file's leading comments (a pragma after the first statement is ignored), so the plugin puts it at the start of line 1.
- plugin-react 6 is Babel-free: it sets `oxc.jsx` (automatic runtime, `importSource` only when given) plus Fast Refresh, and no longer transforms JSX itself. Its default `jsxImportSource` is `react`, which a file pragma overrides.
- Transform hooks take a `filter` (`transform: { filter: { id }, handler }`), which Rolldown applies before calling into JS; `createFilter(include, exclude, { resolve: root })` matches globs.
- The Environment API is available: per-environment config under `environments` (`client`, `ssr`), `this.environment` in hooks, `applyToEnvironment` / `perEnvironmentPlugin` to scope a plugin, and `config.consumer` (`client` | `server`). `createBuilder` / `builder.buildApp` build all environments, and the client and SSR builds use them.
