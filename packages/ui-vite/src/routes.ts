import * as fs from 'node:fs'
import * as path from 'node:path'
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

/** A route file: its table name (file path without extension) and path string. */
interface Route {
  readonly file: string
  readonly name: string
  readonly path: string
}

/** `users/[id].tsx` is `/users/:id`; an `index` file is its directory's path. Throws naming the file when invalid. */
const toRoute = (dir: string, file: string): Route => {
  const name = path.posix.relative(dir, file).replace(ROUTE_FILE, '')
  const segments = name.split('/')
  if (segments.at(-1) === 'index') segments.pop()
  const parts = segments.map((s) => {
    const param = PARAM.exec(s)
    if (param) return `:${param[1]}`
    if (STATIC.test(s)) return s
    throw new Error(`sleekstack: invalid route file ${file}: segment "${s}" is neither a name nor a [param]`)
  })
  return { file, name, path: `/${parts.join('/')}` }
}

/** Sorts so a static segment matches before a param at the same position (`/users/new` before `/users/:id`). */
const sortKey = (route: Route) => route.path.replace(/:\w+/g, '￿')

/** The route files under `dir`, in match order; throws naming the files when two give the same path. */
const scan = (dir: string): Route[] => {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }) : []
  const found = files
    .map((f) => normalizePath(path.join(dir, f)))
    .filter((f) => ROUTE_FILE.test(f) && !f.endsWith('.d.ts'))
    .map((f) => toRoute(dir, f))
    .sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0))
  const byPath = new Map<string, string>()
  for (const r of found) {
    const other = byPath.get(sortKey(r))
    if (other) throw new Error(`sleekstack: route files ${other} and ${r.file} both give path ${r.path}`)
    byPath.set(sortKey(r), r.file)
  }
  return found
}

/**
 * Serves `virtual:sleekstack/routes`: `table`, a `@sleekstack/router` route table built from the files under
 * `routesDir` (params stay in the path strings, ADR 0036), and `pages`, each route file's default export by route name.
 * In dev, adding or removing a route file rebuilds the module and reloads the page.
 */
export const routes = (options: RoutesOptions = {}): Plugin => {
  let dir = ''
  return {
    name: 'sleekstack:routes',
    configResolved(config) {
      dir = normalizePath(path.resolve(config.root, options.routesDir ?? 'src/routes'))
    },
    resolveId: {
      filter: { id: new RegExp(`^${ROUTES_MODULE}$`) },
      handler: () => RESOLVED,
    },
    load: {
      filter: { id: new RegExp(`^\0${ROUTES_MODULE}$`) },
      handler() {
        let found: Route[]
        try {
          found = scan(dir)
        } catch (e) {
          this.error((e as Error).message)
        }
        const imports = found.map((r, i) => `import p${i} from ${JSON.stringify(r.file)}`)
        const table = Object.fromEntries(found.map((r) => [r.name, r.path]))
        const pages = found.map((r, i) => `${JSON.stringify(r.name)}: p${i}`)
        return `${imports.join('\n')}\nexport const table = ${JSON.stringify(table)}\nexport const pages = { ${pages.join(', ')} }\n`
      },
    },
    configureServer(server) {
      const changed = (file: string) => {
        const f = normalizePath(file)
        if (!f.startsWith(`${dir}/`) || !ROUTE_FILE.test(f)) return
        for (const env of Object.values(server.environments)) {
          const mod = env.moduleGraph.getModuleById(RESOLVED)
          if (mod) env.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', changed).on('unlink', changed)
    },
  }
}
