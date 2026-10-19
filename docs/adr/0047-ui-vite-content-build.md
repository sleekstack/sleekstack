# 0047. `@sleekstack/ui-vite`: MDX content, static prerender, search and Open Graph images

## Status

Accepted. Built in spec fn-59 (tasks 3 to 6). `sleekContent` sits beside the `sleekstack()` plugin of fn-29 (ADR 0045) in the same package and does not replace it; `Head` is fn-33 (ADR 0044). It covers the content-site part of fn-30 only.

## Context

A docs site on `@sleekstack/ui` needs MDX pages, a route table from the content tree, static HTML per page, search and share images, without a meta-framework.

## Decision

**MDX pipeline.** `compileMdx` turns a page into a module exporting its component and `frontmatter`, using the ui JSX runtime. GitHub-flavored markdown, heading ids, and `<include>path</include>` (a code block read from a file relative to the page). Code fences highlight at build time with shiki, light and dark; highlighter inline styles become classes, and one stylesheet (`createStyleSheet().css()`) serves all pages. That stylesheet follows `prefers-color-scheme` only; there is no class toggle. The frontmatter parser reads simple `key: value` lines. An unknown fence language or a missing include fails the compile as `file:line: reason`.

**Routes.** `sleekContent({ content, base?, app })` builds a `@sleekstack/router` table (`scanPages`, `contentRouteTable`; distinct from the file-based `routesDir` routes of `sleekstack()`) from the content tree and each directory's `meta.json` order, with `base` prefixed. `content` resolves against the process cwd. The build fails on a broken internal link or anchor. In dev, a page route and `/_sleek/*` go to the `start` fetch handler exported as `app`; start is a dev-only dependency of the site.

**Prerender and hosting.** `prerender: { server, client }` makes `vite build` write `<route>/index.html`. The server entry's `render(path)` returns `{ app, layer }`; the build renders with `renderToString`, takes the `Head` tags from `onHead` (ADR 0044) and writes them, the stylesheet and the client script. The output is plain files that any static host serves; it never imports `@sleekstack/start`. A page that fails fails the build as `prerender /route: reason`. The browser entry hydrates `#app` with `hydrateMount` and must not import `virtual:sleek-content.css`.

**Search index.** `search-index.json` is built from headings and text, one entry per section: `{ title, heading, anchor, text }`, version 1. The client (`@sleekstack/ui-vite/search-client`, no Node imports) scores per term (title 10, heading 5, text 1; every term must hit). A missing index throws `SearchIndexMissing`. The build logs the index size; `search: false` turns it off.

**Open Graph images.** `og: { site, fonts }` writes one 1200 by 630 PNG per page from frontmatter `title` and `description`, with satori and `@resvg/resvg-js`. `site` must be given to the plugin and to `ogMeta` (`@sleekstack/ui-vite/og-meta`, browser-safe: the browser entry must import it so `og:image` is absolute). With `image: false`, `ogMeta` drops `og:image*` and sets `twitter:card` to `summary`. satori is about 25 MB unpacked and resvg is a 3.4 MB native binary, so both load only when `og` is on.

**Packaging.** The plugin does not import `@sleekstack/router` (its extensionless dist imports fail under Node ESM); `ui` and `effect` are peer dependencies. Virtual-module types are not shipped; the site declares them.

## Rejected

- **Server logic in the static output:** it would tie the site to one host.
- **Class-based dark mode in the highlighter:** no consumer needs it yet.

## Consequences

Search ranks naively and holds the whole index in memory. A site changing fonts or the origin rebuilds every image.
