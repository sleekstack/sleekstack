import type { Plugin } from 'vite'
import { analyze } from './analyze.js'
import { entries, type EntriesOptions } from './entries.js'
import { ids } from './ids.js'
import { jsx, type JsxOptions } from './jsx.js'
import { routes, type RoutesOptions } from './routes.js'

export type { EntriesOptions } from './entries.js'
export type { JsxOptions } from './jsx.js'
export type { RoutesOptions } from './routes.js'

/** Options of {@link sleekstack}. */
export type SleekstackOptions = JsxOptions & RoutesOptions & EntriesOptions

/**
 * The SleekStack Vite plugin: ui JSX, stable component ids, `@sleekstack/analyze` diagnostics (dev overlay, failing build),
 * file-based routes (`virtual:sleekstack/routes`) and, with `entries`, client and SSR bundles and dev SSR. Add it beside
 * `@vitejs/plugin-react` when the app has React guests.
 */
export const sleekstack = (options: SleekstackOptions = {}): Array<Plugin> => [
  jsx(options),
  ids(),
  analyze(),
  routes(options),
  entries(options),
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
