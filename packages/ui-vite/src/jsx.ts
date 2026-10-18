import MagicString from 'magic-string'
import { createFilter, type FilterPattern, type Plugin } from 'vite'

/** Which files are ui JSX without writing the pragma. */
export interface JsxOptions {
  readonly include?: FilterPattern
  readonly exclude?: FilterPattern
}

const PRAGMA = '/** @jsxImportSource @sleekstack/ui */'

// oxc reads `@jsxImportSource` only from the comments before the first statement; anywhere else it is plain text.
const LEADING_COMMENTS = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*/
const hasPragma = (code: string): boolean => /@jsxImportSource\s/.test(LEADING_COMMENTS.exec(code)![0])

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
        if (!matches(id) || hasPragma(code)) return null
        const out = new MagicString(code).prepend(PRAGMA)
        return { code: out.toString(), map: out.generateMap({ hires: 'boundary', source: id }) }
      },
    },
  }
}
