import { createFilter, type FilterPattern, type Plugin } from 'vite'

/** Which files are ui JSX without writing the pragma. */
export interface JsxOptions {
  readonly include?: FilterPattern
  readonly exclude?: FilterPattern
}

export const PRAGMA = '/** @jsxImportSource @sleekstack/ui */'

/**
 * Marks include-matched JSX files as ui JSX by adding the pragma, so Vite's oxc transform compiles them against
 * `@sleekstack/ui/jsx-runtime` (ADR 0015). No global `jsxImportSource` is set: a file that already names one keeps
 * it, and a file outside `include` (or inside `exclude`) is left to the default, e.g. `@vitejs/plugin-react`.
 */
export const jsx = (options: JsxOptions = {}): Plugin => {
  let matches = (_id: string) => false
  return {
    name: 'sleekstack:jsx',
    enforce: 'pre',
    configResolved(config) {
      // Relative globs are relative to the Vite root, not the process cwd.
      if (options.include !== undefined)
        matches = createFilter(options.include, options.exclude, { resolve: config.root })
    },
    transform: {
      filter: { id: /\.[jt]sx(?:$|\?)/ },
      handler(code, id) {
        if (!matches(id) || code.includes('@jsxImportSource')) return null
        // oxc reads the pragma only from leading comments; keeping it on line 1 leaves every other line's position
        // as is. ponytail: `map: null` keeps the incoming map, so line-1 columns are off by the pragma's length.
        return { code: PRAGMA + code, map: null }
      },
    },
  }
}
