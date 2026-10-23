import * as fs from 'node:fs'
import * as path from 'node:path'
import ts from 'typescript'
import { normalizePath, type Plugin } from 'vite'

/** Where route files live. */
export interface RoutesOptions {
  /** Directory of route files, relative to the Vite root. Default `src/routes`. */
  readonly routesDir?: string
}

/** The module apps import the route table and pages from. */
const ROUTES_MODULE = 'virtual:sleekstack/routes'
const RESOLVED = `\0${ROUTES_MODULE}`
const ROUTE_FILE = /\.[jt]sx?$/
const STATIC = /^[\w.~-]+$/
const PARAM = /^\[(\w+)\]$/
const OPTIONAL = /^\[\[(\w+)\]\]$/
const SPLAT = /^\[\.\.\.(\w+)\]$/
const GROUP = /^\([\w.~-]+\)$/

/** A route file: its table name (file path without extension), path string, and layouts (outer first). */
interface Route {
  readonly file: string
  readonly name: string
  readonly path: string
  readonly layouts: readonly string[]
}

/** One file segment as a path segment: a name, `:param`, `:param?`, `*splat`, or nothing for a `(group)`. */
const toSegment = (file: string, segment: string): string => {
  const [, param] = PARAM.exec(segment) ?? []
  if (param) return `:${param}`
  const [, optional] = OPTIONAL.exec(segment) ?? []
  if (optional) return `:${optional}?`
  const [, splat] = SPLAT.exec(segment) ?? []
  if (splat) return `*${splat}`
  if (GROUP.test(segment)) return ''
  if (STATIC.test(segment)) return segment
  throw new Error(
    `sleekstack: invalid route file ${file}: segment "${segment}" is neither a name, a [param], a [[param]], a [...splat] nor a (group)`,
  )
}

/**
 * `users/[id].tsx` is `/users/:id`, `[[id]]` is `:id?`, `[...rest]` is `*rest`, a `(group)` directory adds no
 * segment, and an `index` file is its directory's path. Throws naming the file when invalid.
 */
const toRoute = (dir: string, file: string, layouts: ReadonlyMap<string, string>): Route => {
  const name = path.posix.relative(dir, file).replace(ROUTE_FILE, '')
  const segments = name.split('/')
  if (segments.at(-1) === 'index') segments.pop()
  const parts = segments.map((s) => toSegment(file, s)).filter((s) => s !== '')
  if (parts.slice(0, -1).some((s) => s.endsWith('?') || s.startsWith('*')))
    throw new Error(`sleekstack: invalid route file ${file}: an optional or splat segment must be the last one`)
  const dirs = name.split('/').slice(0, -1)
  const chain = ['', ...dirs.map((_, i) => dirs.slice(0, i + 1).join('/'))].flatMap((d) => layouts.get(d) ?? [])
  return { file, name, path: `/${parts.join('/')}`, layouts: chain }
}

/** Ranks a path segment at one position: static, then `:param`, then `:param?`, then `*splat`. */
const rank = (segment: string) =>
  segment.startsWith('*') ? '\uffff' : segment.endsWith('?') ? '\ufffe' : segment.startsWith(':') ? '\ufffd' : segment

/** A path's match-order key; param names are ignored, so it is also the collision key. */
export const sortKey = (p: string) => p.split('/').map(rank).join('/')

/** Orders two paths for matching, as the page routes and the Controllers are ordered. */
export const matchOrder = (a: string, b: string) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0)

/** A file or directory starting with `_` is not a route (helpers, components, tests beside the routes). */
const ignored = (dir: string, file: string) =>
  path.posix
    .relative(dir, file)
    .split('/')
    .some((s) => s.startsWith('_'))

/**
 * Whether `file` has a runtime default export (`export default`, or `default` in an `export { }` list); a type-only
 * one (`export default interface`, `export type { X as default }`) is erased, so it does not count.
 */
const hasDefault = (file: string) => {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest)
  return source.statements.some(
    (s) =>
      ts.isExportAssignment(s) ||
      (!ts.isInterfaceDeclaration(s) &&
        ts.canHaveModifiers(s) &&
        ts.getModifiers(s)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) ||
      (ts.isExportDeclaration(s) &&
        !s.isTypeOnly &&
        s.exportClause !== undefined &&
        ts.isNamedExports(s.exportClause) &&
        s.exportClause.elements.some((e) => !e.isTypeOnly && e.name.text === 'default')),
  )
}

/** Throws naming `file` when it has no default export, the page, layout or not-found component. */
const needDefault = (file: string) => {
  if (!hasDefault(file)) throw new Error(`sleekstack: route file ${file} has no default export`)
}

/**
 * The `_layout` files under `dir` by their directory (`''` at the root); one under a `_` directory is ignored with its
 * subtree. Throws naming both files when a directory has two.
 */
const layoutsOf = (dir: string, files: readonly string[]): Map<string, string> => {
  const layouts = new Map<string, string>()
  for (const f of files) {
    const rel = path.posix.relative(dir, f)
    if (!ROUTE_FILE.test(f) || path.posix.basename(rel).replace(ROUTE_FILE, '') !== '_layout') continue
    const at = path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel)
    if (at.split('/').some((s) => s.startsWith('_'))) continue
    const other = layouts.get(at)
    if (other) throw new Error(`sleekstack: layout files ${other} and ${f} are in one directory`)
    layouts.set(at, f)
  }
  return layouts
}

/** What `routesDir` gives: its routes and its root `_notFound` file, if any. */
interface Scanned {
  readonly found: readonly Route[]
  readonly notFound: string | undefined
}

/**
 * The route files under `dir`, in match order, and the root `_notFound`; throws naming the files when two give the
 * same path or one has no default export.
 */
export const scan = (dir: string): Scanned => {
  const files = (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }) : []).map((f) =>
    normalizePath(path.join(dir, f)),
  )
  const notFound = files.find(
    (f) => ROUTE_FILE.test(f) && path.posix.relative(dir, f).replace(ROUTE_FILE, '') === '_notFound',
  )
  const layouts = layoutsOf(dir, files)
  const found = files
    .filter((f) => ROUTE_FILE.test(f) && !f.endsWith('.d.ts') && !ignored(dir, f))
    .map((f) => toRoute(dir, f, layouts))
    .sort((a, b) => matchOrder(a.path, b.path))
  const byPath = new Map<string, string>()
  for (const r of found) {
    const other = byPath.get(sortKey(r.path))
    if (other) throw new Error(`sleekstack: route files ${other} and ${r.file} both give path ${r.path}`)
    byPath.set(sortKey(r.path), r.file)
  }
  for (const f of [...found.map((r) => r.file), ...layouts.values(), ...(notFound ? [notFound] : [])]) needDefault(f)
  return { found, notFound }
}

/** A route file's exports, beside its default component, that are the rest of its `Page`. */
const PAGE_EXPORTS = ['loaders', 'fallback', 'prerender']

/**
 * The module's code: each page renders its file's default export inside its layouts (outer first) and carries the
 * file's `PAGE_EXPORTS` it has (no `undefined` keys), its `loaders` led by its layouts' loaders, each loader once.
 * Computed keys keep every route name an own property. `notFound` gets no layout: the router runs no loaders for it,
 * so a layout's loaders would never have run. Layouts remount on every navigation, as the router swaps the whole view.
 * When `lazy` (the client), a page is only `{ load }`, importing its file and layouts on first use, so each route is
 * its own chunk; otherwise (SSR and so prerender) every file is imported up front.
 */
const moduleCode = ({ found, notFound }: Scanned, lazy: boolean): string => {
  const key = (r: Route) => `[${JSON.stringify(r.name)}]`
  const layouts = [...new Set(found.flatMap((r) => r.layouts))]
  const imports = lazy
    ? ''
    : [
        ...found.map((r, i) => `import * as p${i} from ${JSON.stringify(r.file)}\n`),
        ...layouts.map((f, i) => `import * as l${i} from ${JSON.stringify(f)}\n`),
      ].join('')
  const table = found.map((r) => `${key(r)}: ${JSON.stringify(r.path)}`).join(', ')
  const chain = (r: Route) => r.layouts.map((f) => `l${layouts.indexOf(f)}`).join(', ')
  const dynamic = (f: string) => `import(${JSON.stringify(f)})`
  const pages = found
    .map((r, i) =>
      lazy
        ? `${key(r)}: { load: () => Promise.all([${[r.file, ...r.layouts].map(dynamic).join(', ')}]).then(([m, ...ls]) => page(m, ls)) }`
        : `${key(r)}: page(p${i}, [${chain(r)}])`,
    )
    .join(', ')
  return `import { jsx } from '@sleekstack/ui/jsx-runtime'
${imports}${notFound ? `import NotFound from ${JSON.stringify(notFound)}\n` : ''}const page = (m, layouts) => {
  const p = { render: () => layouts.reduceRight((children, l) => jsx(l.default, { children }), jsx(m.default, {})) }
  for (const k of ${JSON.stringify(PAGE_EXPORTS)}) if (k in m) p[k] = m[k]
  if (layouts.some((l) => 'loaders' in l)) p.loaders = [...new Set([...layouts, m].flatMap((x) => x.loaders ?? []))]
  return p
}
export const table = { ${table} }
export const pages = { ${pages} }
${notFound ? 'export const notFound = () => jsx(NotFound, {})\n' : ''}`
}

/**
 * The module's types: literal paths, so `Params` reads them as from a hand-written table, and each page typed from its
 * route module (`PAGE_EXPORTS` it has, and a JSX `render`) and its layout modules (outer first, their `loaders` joining
 * the page's), so `router()` infers its requirements as for a literal.
 */
const declaration = (dir: string, { found, notFound }: Scanned): string => {
  const entries = (value: (r: Route) => string) =>
    found.map((r) => `\n    readonly ${JSON.stringify(r.name)}: ${value(r)}`).join('')
  const module = (file: string) => `typeof import(${JSON.stringify(`./${path.posix.relative(dir, file)}`)})`
  const page = (r: Route) =>
    r.layouts.length ? `Page<${module(r.file)}, [${r.layouts.map(module).join(', ')}]>` : `Page<${module(r.file)}>`
  const keys = PAGE_EXPORTS.map((k) => JSON.stringify(k)).join(' | ')
  return `// Written by @sleekstack/ui-vite from the route files in this directory; do not edit.
declare module '${ROUTES_MODULE}' {
  type Render = () => import('@sleekstack/ui/jsx-runtime').JSX.Element
  type LoadersOf<M> = M extends { readonly loaders: ReadonlyArray<infer L> } ? L : never
  type WithLayouts<M, L extends readonly unknown[]> = [L[number]] extends [never]
    ? M
    : [LoadersOf<M | L[number]>] extends [never]
      ? M
      : Omit<M, "loaders"> & { readonly loaders: ReadonlyArray<LoadersOf<M | L[number]>> }
  type Page<M, L extends readonly unknown[] = []> = { readonly render: Render; readonly load?: () => Promise<unknown> } & Pick<
    WithLayouts<M, L>,
    Extract<keyof WithLayouts<M, L>, ${keys}>
  >
  export const table: {${entries((r) => JSON.stringify(r.path))}
  }
  export const pages: {${entries(page)}
  }
${notFound ? `  export const notFound: Page<${module(notFound)}>["render"]\n` : ''}}
`
}

/** Where the module's types are written: inside `routesDir`, so the app's tsconfig already includes it. */
const DECLARATION = 'routes.gen.d.ts'

/** Writes the declaration when it changed; an invalid route file leaves it as it was (the module load reports it). */
const writeDeclaration = (dir: string) => {
  if (!fs.existsSync(dir)) return
  let scanned: Scanned
  try {
    scanned = scan(dir)
  } catch {
    return
  }
  const file = path.join(dir, DECLARATION)
  const text = declaration(dir, scanned)
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text)
}

/**
 * Serves `virtual:sleekstack/routes`: `table`, a `@sleekstack/router` route table built from the files under
 * `routesDir` (params stay in the path strings, ADR 0036); `pages`, a `Page` per route name rendering its file's default
 * export, with the file's `loaders`, `fallback` and `prerender` exports (in the client, only a `load` giving that page,
 * so each route is its own chunk; the types describe the loaded page); and `notFound`, rendering the default export of
 * a root `_notFound` file, only when there is one. Its types are kept in `routes.gen.d.ts` inside `routesDir`. In dev,
 * adding or removing a route file rebuilds the module and its types and reloads the page.
 */
export const routes = (options: RoutesOptions = {}): Plugin => {
  let dir = ''
  return {
    name: 'sleekstack:routes',
    configResolved(config) {
      dir = normalizePath(path.resolve(config.root, options.routesDir ?? 'src/routes'))
    },
    buildStart() {
      writeDeclaration(dir)
    },
    resolveId: {
      filter: { id: new RegExp(`^${ROUTES_MODULE}$`) },
      handler: () => RESOLVED,
    },
    load: {
      filter: { id: new RegExp(`^\0${ROUTES_MODULE}$`) },
      handler() {
        try {
          return moduleCode(scan(dir), this.environment.config.consumer === 'client')
        } catch (e) {
          this.error((e as Error).message)
        }
      },
    },
    configureServer(server) {
      const changed = (file: string) => {
        const f = normalizePath(file)
        if (!f.startsWith(`${dir}/`) || !ROUTE_FILE.test(f) || f.endsWith('.d.ts')) return
        writeDeclaration(dir)
        for (const env of Object.values(server.environments)) {
          const mod = env.moduleGraph.getModuleById(RESOLVED)
          if (mod) env.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      // A routesDir outside the Vite root is not watched by default.
      server.watcher.add(dir)
      server.watcher.on('add', changed).on('unlink', changed)
    },
  }
}
