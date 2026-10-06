import * as fs from 'node:fs'
import * as path from 'node:path'
import { expect, it } from 'vitest'

// Layering for src/ (clean architecture; dependencies point inward). A module's rule is its own entry, else its directory's
// (`dir/`). Each rule lists the local modules (`dir/` = anything in that directory) and packages it may import.
//   domain/          pure model: entities, errors, ports (service Tags); no framework
//   application/     use cases and UI state, built on the domain; no React, no adapters
//   infrastructure/  adapters for the domain's ports: seed data, Layers; knows nothing of the UI
//   presentation/    the UI over the domain and application; never touches infrastructure
//     guests         plain React: knows nothing of the app
//   app, main        composition roots: wire the UI to the adapters
//   resume/*         the resumable counter: no React, no components, no domain
//   size/*           size-budget entries: built `@sleekstack/ui` output only
interface Rule {
  readonly local: ReadonlyArray<string>
  readonly packages: ReadonlyArray<string>
}
const rules: Record<string, Rule> = {
  'domain/': { local: ['domain/'], packages: ['effect'] },
  'application/': {
    local: ['domain/', 'application/'],
    packages: ['effect', '@sleekstack/core', '@sleekstack/query', '@sleekstack/ui/query'],
  },
  'infrastructure/': { local: ['domain/', 'infrastructure/'], packages: ['effect', '@sleekstack/query'] },
  'presentation/': { local: ['domain/', 'application/', 'presentation/'], packages: ['effect', '@sleekstack/ui'] },
  'presentation/guests': { local: [], packages: ['react', '@sleekstack/ui'] },
  app: { local: ['presentation/', 'infrastructure/'], packages: ['@sleekstack/ui'] },
  main: { local: ['app', 'infrastructure/'], packages: ['@sleekstack/ui'] },
  'size/mount': { local: [], packages: ['@sleekstack/ui', 'effect'] },
  'size/hydrate': { local: [], packages: ['@sleekstack/core', '@sleekstack/ui', 'effect'] },
  'resume/count': { local: [], packages: ['@sleekstack/core', 'effect'] },
  'resume/increment': { local: ['resume/count'], packages: ['@sleekstack/ui', 'effect'] },
  'resume/counter': { local: ['resume/count', 'resume/increment'], packages: ['@sleekstack/ui'] },
  'resume/entry': { local: ['resume/count', 'resume/increment'], packages: ['@sleekstack/ui', 'effect'] },
}
const ruleOf = (mod: string): Rule | undefined => rules[mod] ?? rules[mod.slice(0, mod.indexOf('/') + 1)]
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
const allowedPackage = (spec: string, packages: ReadonlyArray<string>) => packages.some((p) => spec === p)

it('every module under src/ has a layering rule, and no rule is stale', () => {
  const mods = files(src).map(moduleOf)
  expect(mods.filter((m) => !ruleOf(m))).toEqual([])
  const stale = Object.keys(rules).filter((r) =>
    r.endsWith('/') ? !mods.some((m) => m.startsWith(r)) : !mods.includes(r),
  )
  expect(stale).toEqual([])
})

it('modules import only what their layer allows', () => {
  const violations: string[] = []
  for (const file of files(src)) {
    const mod = moduleOf(file)
    const rule = ruleOf(mod)
    if (!rule) continue
    for (const spec of importsOf(file)) {
      if (spec.startsWith('.')) {
        const target = path
          .relative(src, path.resolve(path.dirname(file), spec))
          .split(path.sep)
          .join('/')
        // `./infrastructure` is the directory's index
        const dir = fs.existsSync(path.join(src, target)) && fs.statSync(path.join(src, target)).isDirectory()
        if (!allows(rule.local, dir ? `${target}/` : target)) violations.push(`${mod} must not import ./${target}`)
      } else if (!allowedPackage(spec, rule.packages) && !spec.startsWith('node:')) {
        violations.push(`${mod} must not import "${spec}"`)
      }
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
