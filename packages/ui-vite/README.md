# @sleekstack/ui-vite

Decisions: ADR 0042 (void elements, `Head`) and ADR 0043 (this package). Size budget of `ui`: ADR 0022.

Exports: `@sleekstack/ui-vite` (the plugin `sleekContent`, `compileMdx`, `assertLinks`, `findBrokenLinks`), `@sleekstack/ui-vite/search-client` and `@sleekstack/ui-vite/og-meta` (both browser-safe).

`sleekContent` options: `content` (directory, resolved against the cwd), `base?`, `app`, `prerender?: { server, client }`, `search?` (`false` turns the index off), `og?: { site, fonts }`. The frontmatter parser reads simple `key: value` lines only. `ui` and `effect` are peer dependencies; the virtual-module types (`virtual:sleek-content`) are not shipped.

Build pipeline for `@sleekstack/ui` apps. `compileMdx` turns an MDX page into a module that exports its component and `frontmatter`, using the ui JSX runtime.

- `<include>path</include>` expands to a code block read from the file (path relative to the page).
- Code fences are highlighted at build time with shiki (light and dark). Highlighter inline styles become classes; `createStyleSheet().css()` is the one stylesheet for all pages.
- Headings get ids; tables, links and lists are GitHub-flavored markdown.
- Errors read `file:line: reason`, including an unknown fence language and a missing include file.

## Routes, links and the dev entry

`sleekContent({ content, base?, app })` is the Vite plugin. `virtual:sleek-content` exports `routes` (a `@sleekstack/router` table from the content tree and its `meta.json` order, with `base` prefixed) and `pages` (route name to the compiled page loader); `virtual:sleek-content.css` is the highlighting stylesheet. In dev, a page route and `/_sleek/*` go to the `start` fetch handler exported as `app` by the `app` module; a page added, renamed or removed updates the table without a restart, and a content error shows in the overlay until the next good save. The build fails on a broken internal link or anchor (`assertLinks`, `findBrokenLinks`).

## Static build and search

`sleekContent({ ..., prerender: { server, client }, search? })` makes `vite build` write the whole site:

- `client` is the browser entry (the build input). It hydrates `#app` with `hydrateMount`; it must not import `virtual:sleek-content.css`, the plugin writes `assets/sleek-content.css` itself and links it.
- `server` is a module exporting `render(path)`, returning `{ app, layer }` for a route (see `RenderEntry`). The build calls it for every page, renders with `renderToString`, waits for `onHead`, and writes `<route>/index.html` (`/` is `index.html`) with the head tags, the stylesheet and the client script. A page that fails to compile or render fails the build as `prerender /route: reason`.
- Output is plain files and needs no server logic; it never imports `@sleekstack/start`.
- `search-index.json` is written at the end unless `search: false`; the build logs its size. The stylesheet is written last, after every page compiled.

### Search client

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

## Open Graph images

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
