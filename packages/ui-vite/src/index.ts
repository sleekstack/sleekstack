import type { Plugin } from 'vite'
import { analyze } from './analyze.js'
import { ids } from './ids.js'
import { jsx, type JsxOptions } from './jsx.js'
import { routes, type RoutesOptions } from './routes.js'

export type { JsxOptions } from './jsx.js'
export type { RoutesOptions } from './routes.js'

/** Options of {@link sleekstack}. */
export type SleekstackOptions = JsxOptions & RoutesOptions

/**
 * The SleekStack Vite plugin: ui JSX, stable component ids, `@sleekstack/analyze` diagnostics (dev overlay, failing build) and
 * file-based routes (`virtual:sleekstack/routes`). Add it beside `@vitejs/plugin-react` when the app has React guests.
 */
export const sleekstack = (options: SleekstackOptions = {}): Array<Plugin> => [
  jsx(options),
  ids(),
  analyze(),
  routes(options),
]
