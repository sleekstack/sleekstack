import * as fs from 'node:fs'
import * as path from 'node:path'
import { serverServices } from '@sleekstack/ui-vite'
import { build } from 'vite'
import { expect, it } from 'vitest'
import { routes } from '../vite.config'

// Layout of src/ (modular clean architecture; dependencies point inward):
//   modules/<name>/   one per domain (identity, articles, comments), each with its own layers:
//     domain/           pure model: entities, ports (service Tags); no framework
//     application/      use cases and UI state over the domain
//     infrastructure/   adapters for the module's ports; `infrastructure/index` exports its Layers
//     presentation/     the UI
//     index             the module's public API: all another module (or a page) may import
//   errors            the tagged domain error set, shared by every module and both server surfaces
//   routes/           screens, one route file each (`virtual:sleekstack/routes`); import modules only through their `index`
//   pages/            what the screens share (loaders, form parts); import modules only through their `index`
//   layers            composition root: the only importer of the modules' `infrastructure`
//   app, main         composition roots for the UI
// Modules reach each other only through `index`, and only along MODULE_DEPS (no cycles).
// src/ is client code: it never imports `server/` or a Node built-in (`node:sqlite`, `node:crypto`, ...).
const MODULE_DEPS: Record<string, ReadonlyArray<string>> = {
  identity: [],
  articles: ['identity'],
  comments: ['identity', 'articles'],
}

interface Rule {
  /** Local module prefixes (`dir/` = anything in it, else exact) this file may import, besides the module rules below. */
  readonly local: ReadonlyArray<string>
  readonly packages: ReadonlyArray<string>
}
const UI = '@sleekstack/ui'
const ROUTES = 'virtual:sleekstack/routes'
const LAYERS = ['domain', 'application', 'infrastructure', 'presentation'] as const

const ruleOf = (mod: string): Rule | undefined => {
  const m = /^modules\/([^/]+)\/(.+)$/.exec(mod)
  if (m) {
    const [, , rest] = m as unknown as [string, string, string]
    if (rest === 'index') return { local: ['domain/', 'application/', 'presentation/'], packages: [] }
    const layer = rest.split('/')[0]
    if (layer === 'domain') return { local: ['domain/', 'errors'], packages: ['effect'] }
    if (layer === 'application')
      return {
        local: ['domain/', 'application/', 'errors'],
        packages: [
          'effect',
          '@sleekstack/core',
          '@sleekstack/query',
          '@sleekstack/query/ui',
          '@sleekstack/start/client',
          UI,
        ],
      }
    if (layer === 'infrastructure') return { local: ['domain/', 'infrastructure/', 'errors'], packages: ['effect'] }
    if (layer === 'presentation')
      return {
        local: ['domain/', 'application/', 'presentation/', 'errors'],
        packages: ['effect', '@sleekstack/core', '@sleekstack/router', UI],
      }
    return undefined
  }
  if (mod.startsWith('pages/'))
    return {
      local: ['pages/', 'errors'],
      packages: ['effect', '@sleekstack/core', '@sleekstack/model', '@sleekstack/router', UI],
    }
  if (mod.startsWith('routes/'))
    return {
      local: ['routes/', 'pages/', 'errors'],
      packages: [
        'effect',
        '@sleekstack/core',
        '@sleekstack/model',
        '@sleekstack/router',
        UI,
        '@sleekstack/ui/jsx-runtime',
        ROUTES,
      ],
    }
  const exact: Record<string, Rule> = {
    errors: { local: [], packages: ['effect'] },
    layers: { local: [], packages: ['effect', '@sleekstack/query/ui'] },
    app: { local: [], packages: [UI, '@sleekstack/router', ROUTES] },
    main: { local: ['app', 'layers'], packages: ['effect', '@sleekstack/router', 'virtual:sleek/server'] },
  }
  return exact[mod]
}
const allows = (list: ReadonlyArray<string>, target: string) =>
  list.some((l) => (l.endsWith('/') ? target.startsWith(l) : target === l))

const src = path.join(__dirname, '..', 'src')
const files = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : /\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')
          ? [path.join(dir, e.name)]
          : [],
    )
const moduleOf = (file: string) =>
  path
    .relative(src, file)
    .replace(/\.tsx?$/, '')
    .split(path.sep)
    .join('/')
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g
const importsOf = (file: string): string[] => [...fs.readFileSync(file, 'utf8').matchAll(IMPORT)].map((m) => m[1]!)

/** An import's target as a src-relative module: a directory is its `index`. */
const resolve = (file: string, spec: string) => {
  const rel = path
    .relative(src, path.resolve(path.dirname(file), spec))
    .split(path.sep)
    .join('/')
  const abs = path.join(src, rel)
  return fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? `${rel}/index` : rel
}

/** What `file` (under src/) breaks by importing `specs`. */
const violationsOf = (file: string, specs: ReadonlyArray<string>): string[] => {
  const mod = moduleOf(file)
  const rule = ruleOf(mod)
  if (!rule) return [`${mod} has no rule`]
  const self = /^modules\/([^/]+)\//.exec(mod)?.[1]
  const violations: string[] = []
  for (const spec of specs) {
    if (!spec.startsWith('.')) {
      if (!rule.packages.includes(spec)) violations.push(`${mod} must not import "${spec}"`)
      continue
    }
    const target = resolve(file, spec)
    const other = /^modules\/([^/]+)\/(.*)$/.exec(target)
    if (other && other[1] !== self) {
      // Another module: its `index`, along MODULE_DEPS. Its `infrastructure` only from the `layers` root.
      const [, name, rest] = other as unknown as [string, string, string]
      if (mod === 'layers' && (rest === 'infrastructure/index' || rest === 'index')) continue
      if (rest !== 'index')
        violations.push(`${mod} must reach modules/${name} only through its index (imports ./${target})`)
      else if (!self && !mod.startsWith('pages/') && !mod.startsWith('routes/') && mod !== 'app')
        violations.push(`${mod} must not import modules/${name}`)
      else if (self && !MODULE_DEPS[self]!.includes(name))
        violations.push(`modules/${self} must not depend on modules/${name}`)
      continue
    }
    // Within a module `./x/...` paths are module-relative.
    const local = self ? target.replace(`modules/${self}/`, '') : target
    if (!allows(rule.local, local)) violations.push(`${mod} must not import ./${target}`)
  }
  return violations
}

it('every file under src/ has a rule, and every module has only the known layers', () => {
  const mods = files(src).map(moduleOf)
  expect(mods.filter((m) => !ruleOf(m))).toEqual([])
  for (const name of Object.keys(MODULE_DEPS)) {
    const own = mods.filter((m) => m.startsWith(`modules/${name}/`))
    expect(own, name).toContain(`modules/${name}/index`)
    expect(
      own.filter((m) => m !== `modules/${name}/index` && !LAYERS.includes(m.split('/')[2] as (typeof LAYERS)[number])),
    ).toEqual([])
  }
  expect(
    fs.readdirSync(path.join(src, 'modules')).filter((n) => !(n in MODULE_DEPS)),
    'every module has a MODULE_DEPS entry',
  ).toEqual([])
})

it('files import only what their layer allows, and modules reach each other only through index', () => {
  expect(files(src).flatMap((file) => violationsOf(file, importsOf(file)))).toEqual([])
})

it('client code that imports server/ or a Node built-in is a violation', () => {
  const page = path.join(src, 'modules', 'identity', 'presentation', 'login.tsx')
  expect(violationsOf(page, ['../../../../server/db', 'node:sqlite', 'node:crypto'])).toEqual([
    'modules/identity/presentation/login must not import ./../server/db',
    'modules/identity/presentation/login must not import "node:sqlite"',
    'modules/identity/presentation/login must not import "node:crypto"',
  ])
})

const pkg = (p: string) => path.join(__dirname, '../../../packages', p)
// The workspace packages as TypeScript source, so the build never reads a dist that another task is rebuilding.
const sourceAlias = [
  { find: /^@sleekstack\/(ui|core|model|query|router)$/, replacement: pkg('$1/src/index.ts') },
  { find: /^@sleekstack\/(ui|model|query|start)\/(.*)$/, replacement: pkg('$1/src/$2.ts') },
]

it('the client chunk holds no server module', { timeout: 60_000 }, async () => {
  // Strings only the server side holds: the `Db` Tag key and schema (server/db.ts), the password hash format and the dev
  // secret (server/crypto.ts).
  const serverOnly = ['realworld/server/Db', 'CREATE TABLE', 'scrypt$', 'conduit-dev-secret']
  const server = ['db.ts', 'crypto.ts'].map((f) => fs.readFileSync(path.join(__dirname, '../server', f), 'utf8')).join()
  for (const marker of serverOnly) expect(server).toContain(marker)
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [routes(), serverServices()],
    resolve: { alias: sourceAlias },
    define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: true, lib: { entry: path.join(src, 'main.tsx'), formats: ['es'] } },
  })
  const code = (Array.isArray(out) ? out : [out])
    .flatMap((o) => ('output' in o ? o.output : []))
    .map((c) => (c.type === 'chunk' ? c.code : ''))
    .join('\n')
  expect(code).toContain('conduit')
  for (const marker of serverOnly) expect(code, marker).not.toContain(marker)
})
