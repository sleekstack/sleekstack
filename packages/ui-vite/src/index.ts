import type { Plugin } from 'vite'
import { analyze } from './analyze.js'
import { entries, type EntriesOptions } from './entries.js'
import { ids } from './ids.js'
import { jsx, type JsxOptions } from './jsx.js'
import { prerender } from './prerender/build.js'
import type { PrerenderOption } from './prerender/enumerate.js'
import { routes, type RoutesOptions } from './routes.js'
import { serverServices, type ServerServicesOptions } from './server-services.js'

export type { EntriesOptions } from './entries.js'
export type { JsxOptions } from './jsx.js'
export type { PrerenderOption, PrerenderParams } from './prerender/enumerate.js'
export type { RoutesOptions } from './routes.js'
export { serverServices, type ServerServicesOptions } from './server-services.js'
export { devMiddleware } from './dev.js'

/** Options of {@link sleekstack}. */
export type SleekstackOptions = JsxOptions &
  RoutesOptions &
  ServerServicesOptions &
  EntriesOptions & {
    /**
     * Prerender pages to HTML at build: `true` for every static route, or a list of paths; a route's page adds its
     * dynamic paths with `prerender()`. Paths have no trailing slash (root `/`) and are written to `<path>/index.html`.
     * Needs `entries`, whose server entry also exports its router as `router`; `vite build` requests each path from the
     * built server entry, `(request, { onError })`, and writes the response to the client output. A path that throws,
     * answers other than 200 or reports to `onError` fails the build naming it: pass `onError` on to `handle`, the only
     * place a streamed page's render error goes. For the page's `Head` tags in the written head, give `handle` a
     * `document.before` function and no `stream` (a streamed page's tags arrive later, as a script).
     */
    readonly prerender?: PrerenderOption
    /** Hot updates that keep component state (dev only). A ui module that is not components-only reloads the page. Default: true. */
    readonly hmr?: boolean
  }

/**
 * The SleekStack Vite plugin: ui JSX, stable component ids, `@sleekstack/analyze` diagnostics (dev overlay, failing build),
 * file-based routes (`virtual:sleekstack/routes`), Server Service clients and registry (`virtual:sleek/server`,
 * `virtual:sleek/server-registry`) and the discovered app with its Controllers (`virtual:sleek/server-app`;
 * `serverServices` alone for apps that pick plugins) and, with `entries`, client and SSR bundles and dev SSR. Add it beside
 * `@vitejs/plugin-react` when the app has React guests.
 */
export const sleekstack = (options: SleekstackOptions = {}): Array<Plugin> => [
  jsx(options),
  ids(options),
  analyze(undefined, options.serverDir),
  routes(options),
  serverServices(options),
  entries(options),
  prerender(options.prerender, options.entries?.server),
]

// Content sites (ADR 0047): MDX pages, prerender, search and Open Graph images, served by `sleekContent`.
export { createStyleSheet } from './highlight.js'
export {
  type BrokenLink,
  DEFAULT_CONTENT_BASE,
  type Heading,
  type Rebase,
  assertLinks,
  findBrokenLinks,
  headingIds,
  headings,
  rebaseLink,
} from './links.js'
export { type CompileOptions, compileMdx } from './mdx.js'
export type { OgFont, OgOptions } from './og.js'
export { type OgMetaInput, ogMeta } from './og-meta.js'
export { type DocsOptions, sleekContent } from './plugin.js'
export { type ContentPage, type ContentRouteOptions, contentRouteTable, scanPages } from './content-routes.js'
export type { Assets, RenderEntry, Rendered } from './prerender.js'
export { buildSearchIndex, searchEntries } from './search.js'
export {
  loadSearchIndex,
  search,
  type SearchEntry,
  type SearchIndex,
  SearchIndexMissing,
  type SearchResult,
} from './search-client.js'
