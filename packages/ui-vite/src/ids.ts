import * as path from 'node:path'
import MagicString from 'magic-string'
import { normalizePath, parseSync, type ESTree, type Plugin } from 'vite'
import { isUiJsx } from './jsx.js'

/** The property `fnId` in `@sleekstack/ui` reads a component's stable id from. */
const KEY = 'Symbol.for("@sleekstack/ui/component-id")'

/** Top-level value bindings: the only names a module-end statement can reference (not types, imports or `declare`s). */
const valueNames = (body: ReadonlyArray<ESTree.Statement | ESTree.Directive | ESTree.ModuleDeclaration>) => {
  const names = new Set<string>()
  for (const s of body) {
    const d = s.type === 'ExportNamedDeclaration' || s.type === 'ExportDefaultDeclaration' ? s.declaration : s
    if (!d || ('declare' in d && d.declare)) continue
    if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) names.add(d.id.name)
    else if (d.type === 'VariableDeclaration')
      for (const v of d.declarations) if (v.id.type === 'Identifier') names.add(v.id.name)
  }
  return names
}

/** `[local, exported]` for each export of a binding this module declares; re-exports keep their source module's id. */
const ownExports = (program: ESTree.Program): Array<readonly [string, string]> => {
  const values = valueNames(program.body)
  const out: Array<readonly [string, string]> = []
  const add = (local: string, exported: string) => values.has(local) && out.push([local, exported])
  for (const s of program.body) {
    if (s.type === 'ExportNamedDeclaration' && !s.source && s.exportKind !== 'type') {
      const d = s.declaration
      if ((d?.type === 'FunctionDeclaration' || d?.type === 'ClassDeclaration') && d.id) add(d.id.name, d.id.name)
      else if (d?.type === 'VariableDeclaration')
        for (const v of d.declarations) if (v.id.type === 'Identifier') add(v.id.name, v.id.name)
      for (const sp of s.specifiers)
        if (sp.exportKind !== 'type' && sp.local.type === 'Identifier')
          add(sp.local.name, sp.exported.type === 'Identifier' ? sp.exported.name : String(sp.exported.value))
    } else if (s.type === 'ExportDefaultDeclaration') {
      const d = s.declaration
      if ((d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') && d.id) add(d.id.name, 'default')
      else if (d.type === 'Identifier') add(d.name, 'default')
    }
  }
  return out
}

/**
 * Gives each function a ui JSX file exports a stable id, `<path from the Vite root, no extension>#<export name>`, which
 * `fnId` in `@sleekstack/ui` uses instead of its load-order counter. The id is set once on the function object where
 * it is declared, so a re-export (or a later re-evaluation of the same module) keeps it. Two files that would give the
 * same id (`a.tsx` and `a.jsx` both exporting `A`) fail the build. Anonymous default exports keep the counter.
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
        const exported = ownExports(program)
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
        const out = new MagicString(code).append(
          `\n;for (const [f, i] of [${entries.join(', ')}]) if (typeof f === "function" && !Object.hasOwn(f, ${KEY})) Object.defineProperty(f, ${KEY}, { value: i });\n`,
        )
        return { code: out.toString(), map: out.generateMap({ hires: 'boundary', source: moduleId }) }
      },
    },
  }
}
