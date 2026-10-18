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

/**
 * Gives each function a ui JSX file exports a stable id, `<path from the Vite root, no extension>#<export name>`, which
 * `fnId` in `@sleekstack/ui` uses instead of its load-order counter. The id is set once on the function object where
 * it is declared, so a re-export (or a later re-evaluation of the same module) keeps it. Two files that would give the
 * same id (`a.tsx` and `a.jsx` both exporting `A`) fail the build. Only functions written in the export (a declaration,
 * an arrow or function expression) get an id; any other value keeps `fnId`'s counter.
 */
export const ids = (): Plugin => {
  let root = ''
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
        if (!isUiJsx(code)) return null
        const file = normalizePath(moduleId.replace(/\?.*$/, ''))
        const { program, errors } = parseSync(file, code, { lang: file.endsWith('.tsx') ? 'tsx' : 'jsx' })
        // A syntax error is the JSX transform's to report.
        if (errors.length) return null
        const out = new MagicString(code)
        const exported = ownExports(program, out)
        if (!exported.length) return null
        const base = path.posix.relative(normalizePath(root), file).replace(/\.[jt]sx$/, '')
        forget(file)
        const entries = exported.map(([local, name]) => {
          const id = `${base}#${name}`
          const owner = owners.get(id)
          if (owner !== undefined && owner !== file)
            this.error(`sleekstack: duplicate component id "${id}" from ${owner} and ${file}; rename one of them`)
          owners.set(id, file)
          return `[${local}, ${JSON.stringify(id)}]`
        })
        // A function exported under two names keeps the first.
        out.append(
          `\n;for (const [f, i] of [${entries.join(', ')}]) if (!Object.hasOwn(f, ${KEY})) Object.defineProperty(f, ${KEY}, { value: i });\n`,
        )
        return { code: out.toString(), map: out.generateMap({ hires: 'boundary', source: moduleId }) }
      },
    },
  }
}
