import * as fs from 'node:fs'
import * as path from 'node:path'
import { expect, it } from 'vitest'

// Layering for src/: each module lists the local modules and packages it may import. Everything else fails.
//   domain          pure model: types, errors, service Tags (no framework)
//   infrastructure  adapters for the domain's Tags: seed data, Layers
//   state/backlog   UI state and data access, built on the domain
//   guests          plain React; knows nothing of the app
//   components      the UI; never touches infrastructure
//   app, main       composition roots: wire UI to infrastructure
//   resume/*        the resumable counter: no React, no components, no domain
interface Rule {
  readonly local: ReadonlyArray<string>
  readonly packages: ReadonlyArray<string>
}
const rules: Record<string, Rule> = {
  domain: { local: [], packages: ['effect'] },
  infrastructure: { local: ['domain'], packages: ['effect', '@sleekstack/query'] },
  state: { local: ['domain'], packages: ['@sleekstack/core'] },
  backlog: { local: ['domain'], packages: ['effect', '@sleekstack/query', '@sleekstack/ui/query'] },
  guests: { local: [], packages: ['react', '@sleekstack/ui'] },
  components: { local: ['domain', 'state', 'guests', 'backlog'], packages: ['effect', '@sleekstack/ui'] },
  app: { local: ['components', 'domain', 'infrastructure'], packages: ['@sleekstack/ui'] },
  main: { local: ['app', 'infrastructure'], packages: ['@sleekstack/ui'] },
  'resume/count': { local: [], packages: ['@sleekstack/core', 'effect'] },
  'resume/increment': { local: ['resume/count'], packages: ['@sleekstack/ui', 'effect'] },
  'resume/counter': { local: ['resume/count', 'resume/increment'], packages: ['@sleekstack/ui'] },
  'resume/entry': { local: ['resume/count', 'resume/increment'], packages: ['@sleekstack/ui', 'effect'] },
}

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
  expect(files(src).map(moduleOf).sort()).toEqual(Object.keys(rules).sort())
})

it('modules import only what their layer allows', () => {
  const violations: string[] = []
  for (const file of files(src)) {
    const mod = moduleOf(file)
    const rule = rules[mod]
    if (!rule) continue
    for (const spec of importsOf(file)) {
      if (spec.startsWith('.')) {
        const target = path
          .relative(src, path.resolve(path.dirname(file), spec))
          .split(path.sep)
          .join('/')
        if (!rule.local.includes(target)) violations.push(`${mod} must not import ./${target}`)
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
    for (const l of rules[mod]?.local ?? []) reach(l, seen)
    return seen
  }
  const reachable = [...reach('resume/entry')]
  const packages = reachable.flatMap((m) => rules[m]!.packages)
  expect(packages).not.toContain('react')
  expect(reachable.filter((m) => !m.startsWith('resume/'))).toEqual([])
})
