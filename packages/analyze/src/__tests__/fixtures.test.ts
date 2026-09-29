import * as fs from 'node:fs'
import * as path from 'node:path'
import { buildGraph } from '@sleekstack/core'
import { snapshot } from '@sleekstack/kit'
import { describe, expect, it } from 'vitest'
import { analyze } from '../index'

const dir = (name: string) => path.join(__dirname, 'fixtures', name)
const located = (name: string) =>
  analyze({ project: path.join(dir(name), 'tsconfig.json') }).errors.map(({ code, file, line }) => ({ code, file, line }))
/** Every `// @error Code` marker in a fixture, as the error the analyzer must report on that line. */
const expected = (name: string) =>
  fs.readdirSync(dir(name)).filter((f) => f.endsWith('.ts')).sort().flatMap((file) =>
    fs.readFileSync(path.join(dir(name), file), 'utf8').split('\n').flatMap((l, i) => {
      const m = /\/\/ @error (\w+)/.exec(l)
      return m ? [{ code: m[1]!, file, line: i + 1 }] : []
    }))
const sorted = <T extends { file: string; line: number }>(xs: T[]) => xs.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

const graphErrors = ['missing-dependency', 'dependency-cycle', 'captive-dependency', 'ambiguous-provider', 'module-cycle', 'duplicate-module', 'private-dependency']

describe('graph error fixtures', () => {
  it.each(graphErrors)('%s: code and file:line, kit and core declarations', async (name) => {
    const want = expected(name)
    expect(want.map((e) => e.file)).toEqual(expect.arrayContaining(['core.ts', 'kit.ts']))
    expect(sorted(located(name))).toEqual(want)
    // The runtime throws the same code for the same declarations.
    const kit = await import(/* @vite-ignore */ path.join(dir(name), 'kit.ts'))
    const core = await import(/* @vite-ignore */ path.join(dir(name), 'core.ts'))
    expect(() => snapshot(kit.App)).toThrow(expect.objectContaining({ code: want[0]!.code }))
    expect(() => buildGraph([core.App])).toThrow(expect.objectContaining({ _tag: want[0]!.code }))
  })

  it('.map- and loop-built lists over precise types extract every member; any and Layer<any>[] fail', () => {
    const r = analyze({ project: path.join(dir('computed-lists'), 'tsconfig.json') })
    expect(sorted(located('computed-lists'))).toEqual(expected('computed-lists'))
    const tags = (root: string) => r.graphs.find((g) => g.root === root)!.nodes.map((n) => n.id).sort()
    expect(tags('Mapped')).toEqual(['A', 'B'])
    expect(tags('Looped')).toEqual(['A', 'B', 'C'])
    // A named mapper list reused by two modules keeps identity (no AmbiguousProvider); a conditional element yields both branches.
    expect(tags('Named')).toEqual(['A', 'B', 'C', 'D'])
    // Each helper call binds its own argument; concat/slice keep every member.
    expect(tags('Helpers')).toEqual(['A', 'A@H2', 'B'])
    // A mapper returning one shared layer is one provider; mapped modules keep their own names.
    expect(tags('Reused')).toEqual(['C'])
    expect(tags('Delegated')).toEqual(['A', 'B'])
    expect(r.graphs.find((g) => g.root === 'Reused')!.modules.map((m) => m.name).sort()).toEqual(['M1', 'M2', 'Reused'])
  })

  it('ambiguity poisons no downstream check; a partially shadowed layer keeps its full id', () => {
    expect(analyze({ project: path.join(dir('ambiguity-follow-on'), 'tsconfig.json') }).errors.map((e) => [e.code, e.message])).toEqual([
      ['AmbiguousProvider', 'Tag "A" is provided by several entries at the same precedence: module "L1", module "L2"'],
      ['MissingDependency', 'Service "B+M" (module "Lib") requires "Z", but no entry provides it. If a raw Layer provides it, wrap it with declareLayer(layer, { provides: [...] }).'],
    ])
  })

  it('action bodies: yielded Tags (through helper generators) must be declared, provided, visible and nameable', () => {
    expect(sorted(located('actions'))).toEqual(expected('actions'))
    const r = analyze({ project: path.join(dir('actions'), 'tsconfig.json') })
    expect(r.runtimes[0]!.errors.map((e) => e.code).sort()).toEqual(['MissingDependency', 'MissingDependency', 'PrivateDependency'])
  })

  it('clean projects yield no errors', () => {
    expect(located('kit-app')).toEqual([])
    expect(located('core-app')).toEqual([])
    // Each runtime checks only the actions its file reaches.
    expect(located('actions-roots')).toEqual([])
  })
})
