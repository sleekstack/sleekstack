# 0044. The docs site is a `@sleekstack/ui` app built with `@sleekstack/ui-vite`; `start` serves it only in dev

## Status

Accepted. Built in spec fn-60. Supersedes ADR 0007 (Next.js and Fumadocs). Folds the open spec fn-34 (ui API reference) into this work.

## Context

`apps/docs` was a Next 15 and Fumadocs site that imported kit, react, next and islands. The framework replaces those packages, so the site cannot stay on them, and the four packages cannot be deleted while it does (spec fn-55, task 6).

## Decision

**Stack.** `apps/docs` is a ui app on the ui-vite build (ADR 0043). `vite build` writes static pages, `search-index.json` and Open Graph images. `@sleekstack/start` is a devDependency used only by `vite` in dev (`src/app.tsx`); the build output never imports it. Plain CSS in `src/styles.css`: no Tailwind, PostCSS or Fumadocs CSS.

**Layout.** Sidebar from `content/docs/meta.json` with collapse and a mobile drawer, light and dark theme (system default, remembered choice, no flash), previous and next footer, and a cmd-K search dialog over the build-time index (`@sleekstack/ui-vite/search-client`). Content is readable without JavaScript.

**Routes.** Pages live under a base prefix (`VITE_DOCS_BASE`, default `/docs`); `VITE_DOCS_SITE` (default `https://sleekstack.dev`) is the origin for absolute `og:` URLs. The plugin's `contentBase` option (default `/docs`) rewrites content links written with the default prefix to the configured base, so a build with another base passes the link checker. When the base moves the index, a root `index.html` redirects to it. `@sleekstack/ui-vite` exports `./links` and `./routes`. One version, English only, no analytics.

**API reference.** TypeDoc generation and the coverage test stay. Documented packages are the surviving ones, now including ui and start; ui's `jsx-dev-runtime` entry is filtered out.

**Tests and scripts.** Link checker, stale phrases, benchmarks page, API coverage, guides and examples carry over. `dev`, `build` and `typecheck` run without Next.

**Dropped from Fumadocs.** The Orama search route (replaced by the static index), Fumadocs UI components and theme, `fumadocs-mdx` and its `<include>` handling (ui-vite's `compileMdx` does it), and Next routing and metadata. Nothing else on the site used Fumadocs features: no versions, locales, analytics or edit-on-GitHub links existed.

## Known gaps

- The default origin `https://sleekstack.dev` is a constant in the site, not confirmed with the owner.
- The nav loads every page title in the browser, so the client entry is 448 KB. Exposing titles from the routes module would remove that.
- The dev page is served without a doctype, and hydration was not tested in a browser.
- `react` and `react-dom` remain docs devDependencies for two `fromReact` snippets (`snippets/ui/components.tsx`, `snippets/queries-ui.tsx`) and the devtools snippet. R8 forbids the four packages and Next, not React itself, and React guests stay in ui until a later decision; if React is dropped from ui, those snippets go with it.

## Rejected

- A new visual design (needs design decisions first), keeping Tailwind (a styling tool as a dependency of a ui app), and versions, locales or analytics now (none existed).
