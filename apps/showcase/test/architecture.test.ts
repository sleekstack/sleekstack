import * as fs from 'node:fs'
import * as path from 'node:path'
import { expect, it } from 'vitest'

// Layout of src/ (modular clean architecture; dependencies point inward):
//   modules/<name>/   one per domain (identity, projects, tasks), each with its own layers:
//     domain/           pure model: entities, errors, ports (service Tags); no framework
//     application/      use cases and UI state over the domain
//     infrastructure/   adapters for the module's ports; `infrastructure/index` exports its Layers
//     presentation/     the UI; `guests` / `avatar` are plain React and know nothing of the app
//     index             the module's public API: all another module (or a page) may import
//   pages/            compose modules into screens; import modules only through their `index`
//   layers            composition root: the only importer of the modules' `infrastructure`
//   app, main         composition roots for the UI
//   devtools          dev-only React root for the `@sleekstack/devtools` ui panel, loaded by main
//   resume/*          the resumable counter: no React, no components, no domain
//   size/*            size-budget entries: built `@sleekstack/ui` output only
// Modules reach each other only through `index`, and only along MODULE_DEPS (no cycles).
const MODULE_DEPS: Record<string, ReadonlyArray<string>> = { identity: [], projects: [], tasks: ['identity'] }

interface Rule {
  /** Local module prefixes (`dir/` = anything in it, else exact) this file may import, besides the module rules below. */
  readonly local: ReadonlyArray<string>
  readonly packages: ReadonlyArray<string>
}
const UI = '@sleekstack/ui'
const LAYERS = ['domain', 'application', 'infrastructure', 'presentation'] as const
const PLAIN_REACT = new Set(['presentation/guests', 'presentation/avatar'])

const ruleOf = (mod: string): Rule | undefined => {
  const m = /^modules\/([^/]+)\/(.+)$/.exec(mod)
  if (m) {
    const [, , rest] = m as unknown as [string, string, string]
    if (rest === 'index') return { local: ['domain/', 'application/', 'presentation/'], packages: [] }
    if (PLAIN_REACT.has(rest)) return { local: [], packages: ['react', UI] }
    const layer = rest.split('/')[0]
    if (layer === 'domain') return { local: ['domain/'], packages: ['effect'] }
    if (layer === 'application')
      return {
        local: ['domain/', 'application/'],
        packages: ['effect', '@sleekstack/core', '@sleekstack/query', '@sleekstack/query/ui', UI],
      }
    if (layer === 'infrastructure') return { local: ['domain/', 'infrastructure/'], packages: ['effect'] }
    if (layer === 'presentation')
      return { local: ['domain/', 'application/', 'presentation/'], packages: ['effect', UI] }
    return undefined
  }
  if (mod.startsWith('pages/')) return { local: ['pages/'], packages: ['effect', '@sleekstack/core', UI] }
  const exact: Record<string, Rule> = {
    layers: { local: [], packages: ['effect', '@sleekstack/query/ui'] },
    app: { local: ['layers', 'pages/'], packages: [UI] },
    main: { local: ['app', 'layers', 'devtools'], packages: [UI, '@sleekstack/core', '@sleekstack/devtools'] },
    devtools: { local: [], packages: ['@sleekstack/devtools', 'react-dom/client'] },
    'size/mount': { local: [], packages: [UI, 'effect'] },
    'size/hydrate': { local: [], packages: ['@sleekstack/core', UI, 'effect'] },
    'size/lazy': { local: ['size/heavy'], packages: [UI, 'effect'] },
    'size/heavy': { local: [], packages: [] },
    'resume/count': { local: [], packages: ['@sleekstack/core', 'effect'] },
    'resume/increment': { local: ['resume/count'], packages: [UI, 'effect'] },
    'resume/counter': { local: ['resume/count', 'resume/increment'], packages: [UI] },
    'resume/entry': { local: ['resume/count', 'resume/increment'], packages: [UI, 'effect'] },
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
      e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [],
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
  return fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? { target: `${rel}/index`, dir: rel } : { target: rel }
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
  const violations: string[] = []
  for (const file of files(src)) {
    const mod = moduleOf(file)
    const rule = ruleOf(mod)
    if (!rule) continue
    const self = /^modules\/([^/]+)\//.exec(mod)?.[1]
    for (const spec of importsOf(file)) {
      if (!spec.startsWith('.')) {
        if (!rule.packages.includes(spec) && !spec.startsWith('node:'))
          violations.push(`${mod} must not import "${spec}"`)
        continue
      }
      const { target } = resolve(file, spec)
      const other = /^modules\/([^/]+)\/(.*)$/.exec(target)
      if (other && other[1] !== self) {
        // Another module: its `index`, along MODULE_DEPS. Its `infrastructure` only from the `layers` root.
        const [, name, rest] = other as unknown as [string, string, string]
        if (mod === 'layers' && (rest === 'infrastructure/index' || rest === 'index')) continue
        if (rest !== 'index')
          violations.push(`${mod} must reach modules/${name} only through its index (imports ./${target})`)
        else if (!self && !mod.startsWith('pages/') && mod !== 'app')
          violations.push(`${mod} must not import modules/${name}`)
        else if (self && !MODULE_DEPS[self]!.includes(name))
          violations.push(`modules/${self} must not depend on modules/${name}`)
        continue
      }
      // Within a module `./x/...` paths are module-relative.
      const local = self ? target.replace(`modules/${self}/`, '') : target
      if (!allows(rule.local, local)) violations.push(`${mod} must not import ./${target}`)
    }
  }
  expect(violations).toEqual([])
})

it('the resume entry stays free of React, so the resumed page ships no component code', () => {
  const reach = (mod: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(mod)) return seen
    seen.add(mod)
    for (const l of ruleOf(mod)?.local ?? []) reach(l, seen)
    return seen
  }
  const reachable = [...reach('resume/entry')]
  const packages = reachable.flatMap((m) => ruleOf(m)!.packages)
  expect(packages).not.toContain('react')
  expect(reachable.filter((m) => !m.startsWith('resume/'))).toEqual([])
})
