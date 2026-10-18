import type { Plugin } from 'vite'
import { jsx, type JsxOptions } from './jsx.js'

export type { JsxOptions } from './jsx.js'

/** Options of {@link sleekstack}. */
export type SleekstackOptions = JsxOptions

/** The SleekStack Vite plugin. Add it beside `@vitejs/plugin-react` when the app has React guests. */
export const sleekstack = (options: SleekstackOptions = {}): Array<Plugin> => [jsx(options)]
