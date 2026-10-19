import * as path from 'node:path'
import MagicString from 'magic-string'
import { normalizePath, parseSync, type ESTree, type Plugin } from 'vite'
import { isUiJsx } from './jsx.js'

/** The property `fnId` in `@sleekstack/ui` reads a component's stable id from. */
const KEY = 'Symbol.for("@sleekstack/ui/component-id")'
// `async function*` up to where a name goes, comments allowed between the tokens.
const GAP = String.raw`(?:\s|//[^\n]*(?:\n|$)|/\*[\s\S]*?\*/)*`
const FUNCTION_HEAD = new RegExp(`^(?:async${GAP})?function${GAP}(?:\\*${GAP})?`)

type Node = { readonly type: string; readonly start: number; readonly end: number; readonly [k: string]: any }

const unwrap = (e: Node): Node =>
  e.type === 'TSAsExpression' || e.type === 'TSSatisfiesExpression' || e.type === 'ParenthesizedExpression'
    ? unwrap(e.expression)
    : e
const isFunction = (e: Node | null | undefined): boolean =>
  !!e && ['ArrowFunctionExpression', 'FunctionExpression', 'FunctionDeclaration'].includes(unwrap(e).type)

/** Top-level bindings whose value is a function written in place: the only exports that get an id. */
const functionNames = (body: ReadonlyArray<ESTree.Statement | ESTree.Directive | ESTree.ModuleDeclaration>) => {
  const names = new Set<string>()
  for (const s of body) {
    const d = s.type === 'ExportNamedDeclaration' || s.type === 'ExportDefaultDeclaration' ? s.declaration : s
    if (!d || ('declare' in d && d.declare)) continue
    if (d.type === 'FunctionDeclaration' && d.id) names.add(d.id.name)
    else if (d.type === 'VariableDeclaration')
      for (const v of d.declarations) if (v.id.type === 'Identifier' && isFunction(v.init)) names.add(v.id.name)
  }
  return names
}

/**
 * `[local, exported]` for each function export this module declares; re-exports keep their source module's id. An
 * anonymous default function gets a local binding (`out` is edited) so it can be named.
 */
const ownExports = (program: ESTree.Program, out: MagicString): Array<readonly [string, string]> => {
  const functions = functionNames(program.body)
  const found: Array<readonly [string, string]> = []
  const add = (local: string, exported: string) => functions.has(local) && found.push([local, exported])
  for (const s of program.body) {
    if (s.type === 'ExportNamedDeclaration' && !s.source && s.exportKind !== 'type') {
      const d = s.declaration
      if (d?.type === 'FunctionDeclaration' && d.id) add(d.id.name, d.id.name)
      else if (d?.type === 'VariableDeclaration')
        for (const v of d.declarations) if (v.id.type === 'Identifier') add(v.id.name, v.id.name)
      for (const sp of s.specifiers)
        if (sp.exportKind !== 'type' && sp.local.type === 'Identifier')
          add(sp.local.name, sp.exported.type === 'Identifier' ? sp.exported.name : String(sp.exported.value))
    } else if (s.type === 'ExportDefaultDeclaration') {
      const d = s.declaration as Node
      if (d.type === 'FunctionDeclaration' && d.id) add(d.id.name, 'default')
      else if (d.type === 'Identifier') add(d.name, 'default')
      else if (isFunction(d)) {
        let local = '__sleekstack_default'
        while (out.original.includes(local)) local += '_'
        if (d.type === 'FunctionDeclaration') {
          // Stays a hoisted declaration: only the name is added, after `function` / `function*` and any comments.
          const head = FUNCTION_HEAD.exec(out.original.slice(d.start, d.end))![0]
          out.appendLeft(d.start + head.length, ` ${local}`)
        } else {
          out.overwrite(s.start, d.start, `const ${local} = `)
          out.appendLeft(d.end, `;\nexport default ${local}`)
        }
        found.push([local, 'default'])
      }
    }
  }
  return found
}

// Declarations TypeScript erases; enums and namespaces are runtime values.
const ERASED = new Set(['TSTypeAliasDeclaration', 'TSInterfaceDeclaration'])

/** How many value exports the module has: anything a re-evaluation could not swap in place counts. */
const valueExportCount = (program: ESTree.Program): number => {
  let n = 0
  for (const s of program.body) {
    if (s.type === 'ExportAllDeclaration') n += s.exportKind === 'type' ? 0 : 1
    else if (s.type === 'ExportDefaultDeclaration') n += 1
    else if (s.type === 'ExportNamedDeclaration' && s.exportKind !== 'type') {
      const d = s.declaration
      if (d?.type === 'VariableDeclaration') n += d.declarations.length
      else if (d && !ERASED.has(d.type) && !('declare' in d && d.declare)) n += 1
      n += s.specifiers.filter((sp) => sp.exportKind !== 'type').length
    }
  }
  return n
}

/**
 * Gives each function a ui JSX file exports a stable id, `<path from the Vite root, no extension>#<export name>`, which
 * `fnId` in `@sleekstack/ui` uses instead of its load-order counter. The id is set once on the function object where
 * it is declared, so a re-export (or a later re-evaluation of the same module) keeps it. Two files that would give the
 * same id (`a.tsx` and `a.jsx` both exporting `A`) fail the build. Only functions written in the export (a declaration,
 * an arrow or function expression) get an id; any other value keeps `fnId`'s counter.
 *
 * With `hmr` (the default, dev server only) a module whose value exports are all such functions also registers them with
 * `acceptUpdate` and accepts its own updates, so an edit swaps the components and keeps their state. A ui module that
 * exports anything else invalidates the update, which ends in a full reload. Modules without the ui pragma (React
 * guests) get no HMR code.
 */
export const ids = (options: { readonly hmr?: boolean } = {}): Plugin => {
  let root = ''
  let hot = false
  // id -> the file that owns it, for the duplicate check; reset per build, and per file as it re-transforms in dev.
  const owners = new Map<string, string>()
  const forget = (file: string) => {
    for (const [id, owner] of owners) if (owner === file) owners.delete(id)
  }
  return {
    name: 'sleekstack:ids',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
      hot = options.hmr !== false && config.command === 'serve'
    },
    buildStart() {
      owners.clear()
    },
    watchChange(file, { event }) {
      if (event === 'delete') forget(normalizePath(file))
    },
    transform: {
      filter: { id: /\.[jt]sx(?:$|\?)/ },
      handler(code, moduleId) {
        const file = normalizePath(moduleId.replace(/\?.*$/, ''))
        // A file that stops exporting components releases its ids, even on the early returns below.
        forget(file)
        if (!isUiJsx(code)) return null
        const { program, errors } = parseSync(file, code, { lang: file.endsWith('.tsx') ? 'tsx' : 'jsx' })
        // A syntax error is the JSX transform's to report.
        if (errors.length) return null
        const out = new MagicString(code)
        const exported = ownExports(program, out)
        if (!exported.length && !hot) return null
        const base = path.posix.relative(normalizePath(root), file).replace(/\.[jt]sx$/, '')
        const entries = exported.map(([local, name]) => {
          const id = `${base}#${name}`
          const owner = owners.get(id)
          if (owner !== undefined && owner !== file)
            this.error(`sleekstack: duplicate component id "${id}" from ${owner} and ${file}; rename one of them`)
          owners.set(id, file)
          return `[${local}, ${JSON.stringify(id)}]`
        })
        const list = `[${entries.join(', ')}]`
        // A function exported under two names keeps the first.
        if (entries.length)
          out.append(
            `\n;for (const [f, i] of ${list}) if (!Object.hasOwn(f, ${KEY})) Object.defineProperty(f, ${KEY}, { value: i });\n`,
          )
        if (hot) {
          // Vite runs the PREVIOUS evaluation's accept callback with the update, so each evaluation leaves its verdict in
          // `hot.data` for the callback to read; a page reload, not `invalidate`, because a self-accepting parent would stop that.
          const only = entries.length > 0 && valueExportCount(program) === exported.length
          out.append(
            `${only ? 'import { acceptUpdate as __sleekstack_accept } from "@sleekstack/ui/internal";\n' : ''}` +
              `if (import.meta.hot) { import.meta.hot.data.sleekstackOnly = ${only};` +
              `${only ? ` for (const [f, i] of ${list}) __sleekstack_accept(i, f);` : ''}` +
              ` import.meta.hot.accept(() => { if (!import.meta.hot.data.sleekstackOnly) typeof location === "undefined" ? import.meta.hot.invalidate() : location.reload() }) }\n`,
          )
        }
        return { code: out.toString(), map: out.generateMap({ hires: 'boundary', source: moduleId }) }
      },
    },
  }
}
