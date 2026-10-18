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
