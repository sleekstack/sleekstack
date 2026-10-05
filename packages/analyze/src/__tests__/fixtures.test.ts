import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyze } from '../index'

const dir = (name: string) => path.join(__dirname, 'fixtures', name)
const located = (name: string) =>
  analyze({ project: path.join(dir(name), 'tsconfig.json') }).errors.map(({ code, file, line }) => ({
    code,
    file,
    line,
  }))
/** Every `// @error Code` marker in a fixture, as the error the analyzer must report on that line. */
const expected = (name: string) =>
  fs
    .readdirSync(dir(name))
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .flatMap((file) =>
      fs
        .readFileSync(path.join(dir(name), file), 'utf8')
        .split('\n')
        .flatMap((l, i) => {
          const m = /\/\/ @error (\w+)/.exec(l)
          return m ? [{ code: m[1]!, file, line: i + 1 }] : []
        }),
    )
const sorted = <T extends { file: string; line: number }>(xs: T[]) =>
  xs.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

const graphErrors = [
  'missing-dependency',
  'dependency-cycle',
  'captive-dependency',
  'ambiguous-provider',
  'module-cycle',
  'duplicate-module',
  'private-dependency',
]

describe('graph error fixtures', () => {
  it.each(graphErrors)('%s: code and file:line, kit and core declarations', (name) => {
    const want = expected(name)
    expect(want.map((e) => e.file)).toEqual(expect.arrayContaining(['core.ts', 'kit.ts']))
    expect(sorted(located(name))).toEqual(want)
  })

  it('.map- and loop-built lists over precise types extract every member; any and Layer<any>[] fail', () => {
    const r = analyze({ project: path.join(dir('computed-lists'), 'tsconfig.json') })
    expect(sorted(located('computed-lists'))).toEqual(expected('computed-lists'))
    const tags = (root: string) =>
      r.graphs
        .find((g) => g.root === root)!
        .nodes.map((n) => n.id)
        .sort()
    expect(tags('Mapped')).toEqual(['A', 'B'])
    expect(tags('Looped')).toEqual(['A', 'B', 'C'])
    // A named mapper list reused by two modules keeps identity (no AmbiguousProvider); a conditional element yields both branches.
    expect(tags('Named')).toEqual(['A', 'B', 'C', 'D'])
    // Each helper call binds its own argument; concat/slice keep every member.
    expect(tags('Helpers')).toEqual(['A', 'A@H2', 'B'])
    // A mapper returning one shared layer is one provider; mapped modules keep their own names.
    expect(tags('Reused')).toEqual(['C'])
    expect(tags('Delegated')).toEqual(['A', 'B'])
    expect(
      r.graphs
        .find((g) => g.root === 'Reused')!
        .modules.map((m) => m.name)
        .sort(),
    ).toEqual(['M1', 'M2', 'Reused'])
  })

  it('ambiguity poisons no downstream check; a partially shadowed layer keeps its full id', () => {
    expect(
      analyze({ project: path.join(dir('ambiguity-follow-on'), 'tsconfig.json') }).errors.map((e) => [
        e.code,
        e.message,
      ]),
    ).toEqual([
      ['AmbiguousProvider', 'Tag "A" is provided by several entries at the same precedence: module "L1", module "L2"'],
      [
        'MissingDependency',
        'Service "B+M" (module "Lib") requires "Z", but no entry provides it. If a raw Layer provides it, wrap it with declareLayer(layer, { provides: [...] }).',
      ],
    ])
  })

  it('action bodies: yielded Tags (through helper generators) (and opts.scope) must be provided, visible and nameable', () => {
    expect(sorted(located('actions'))).toEqual(expected('actions'))
    const r = analyze({ project: path.join(dir('actions'), 'tsconfig.json') })
    // An action body with no readable declaration fails the whole check.
    expect(r.extraction.map((e) => [e.code, e.file])).toContainEqual(['Unresolvable', 'effects.ts'])
    expect(r.runtimes[0]!.errors.map((e) => e.code).sort()).toEqual([
      'MissingDependency',
      'MissingDependency',
      'MissingDependency',
      'MissingDependency',
      'MissingDependency',
      'MissingDependency',
      'MissingDependency',
      'MissingDependency',
      'PrivateDependency',
      'PrivateDependency',
    ]) // runOperation + its deprecated alias effect (ADR 0019)
  })

  it('query and mutation fetchers: requirements checked like action bodies; non-static keys are Computed', () => {
    expect(sorted(located('queries'))).toEqual(expected('queries'))
  })

  it('generator layers: yielded Tags are edges feeding missing, captive and cycle checks', () => {
    expect(sorted(located('generator-layers'))).toEqual(expected('generator-layers'))
    const ok = analyze({ project: path.join(dir('generator-layers'), 'tsconfig.json') }).graphs.find(
      (g) => g.root === 'Ok',
    )!
    expect(ok.edges).toEqual([{ from: 'B', to: 'A', tag: 'A' }])
  })

  it('ported buildGraph/snapshot tests (.flow/notes/fn-9-build-time-error-port-list.md): code, file:line', () => {
    expect(sorted(located('ported'))).toEqual(expected('ported'))
    expect(
      analyze({ project: path.join(dir('ported'), 'tsconfig.json') }).errors.find(
        (e) => e.file === 'core.ts' && e.code === 'MissingDependency',
      )?.message,
    ).toContain('declareLayer')
  })

  it('plain Layers from configureRuntime({ layer }): leaves typed into provides/requires edges; any fails closed', () => {
    expect(sorted(located('plain-layers'))).toEqual(expected('plain-layers'))
    const r = analyze({ project: path.join(dir('plain-layers'), 'tsconfig.json') })
    const ok = r.runtimes.find((x) => x.file === 'runtime.ts')!
    expect(ok.errors).toEqual([])
    expect(ok.graph.nodes.map((n) => [n.id, n.lifetime]).sort()).toEqual([
      ['ActivityLog', 'app'],
      ['Clock', 'app'],
      ['IdGen', 'app'],
      ['Store', 'app'],
      ['TaskRepo', 'app'],
    ])
    expect(ok.graph.edges.map((e) => `${e.from}->${e.to}`).sort()).toEqual([
      'ActivityLog->Clock',
      'TaskRepo->Clock',
      'TaskRepo->IdGen',
      'TaskRepo->Store',
    ])
    expect(r.runtimes.find((x) => x.file === 'bad.ts')!.errors.map((e) => [e.code, e.line])).toEqual([['Computed', 6]])
  })

  it('plain Layers keyed by Context.GenericTag resolve through the service type; a shared type is ambiguous', () => {
    expect(sorted(located('plain-layers-generic'))).toEqual(expected('plain-layers-generic'))
    const r = analyze({ project: path.join(dir('plain-layers-generic'), 'tsconfig.json') })
    const ok = r.runtimes.find((x) => x.file === 'runtime.ts')!
    expect(ok.errors).toEqual([])
    expect(ok.graph.edges.map((e) => `${e.from}->${e.to}`).sort()).toEqual([
      'ActivityLog->Clock',
      'TaskRepo->Clock',
      'TaskRepo->IdGen',
      'TaskRepo->Store',
    ])
    expect(r.runtimes.find((x) => x.file === 'bad.ts')!.errors.map((e) => e.code)).toEqual(['Computed'])
  })

  it('runEffect request/overrides layers are roots over the app graph; non-literal options fail closed', () => {
    expect(sorted(located('request-roots'))).toEqual(expected('request-roots'))
    const r = analyze({ project: path.join(dir('request-roots'), 'tsconfig.json') })
    const roots = r.runtimes.map((x) => [x.kind, x.graph.root, x.line, x.errors.map((e) => e.code)])
    expect(roots).toEqual([
      ['app', 'runtime.ts:5', 5, []],
      ['request', 'ReqLive', 18, []],
      ['request', 'BadReqLive', 19, ['MissingDependency']],
      ['overrides', 'AppMock', 20, []],
      ['overrides', 'ALive', 20, []],
      ['overrides', 'ALive', 21, []],
      ['request', 'Untyped', 24, ['Computed']],
      // Conditionals behind a const and an import expand; a branch resolving to undefined is skipped.
      ['request', 'ReqLive', 25, []],
      ['request', 'ALive', 25, []],
      ['request', 'ReqLive', 26, []],
      ['request', 'ALive', 26, []],
      ['overrides', 'ReqLive', 27, []],
      // String-literal and computed string keys.
      ['request', 'ReqLive', 28, []],
      ['overrides', 'ALive', 28, []],
    ])
    // Edges into the app graph; an overrides layer shadows the app's Tag.
    expect(r.runtimes[1]!.graph.edges).toEqual([{ from: 'Req', to: 'App', tag: 'App' }])
    expect(r.runtimes[3]!.graph.shadowing).toEqual([{ tag: 'App', winner: 'App', shadowed: ['App@runtime.ts:5'] }])
    expect(r.extraction.map((e) => e.code)).toEqual(['NonLiteralOptions', 'NonLiteralOptions'])
    // Lenient: the unresolvable layer is an opaque root with its file:line, not an error.
    const lenient = analyze({ project: path.join(dir('request-roots'), 'tsconfig.json'), lenient: true }).runtimes.find(
      (x) => x.line === 24,
    )!
    expect([
      lenient.kind,
      lenient.file,
      lenient.line,
      lenient.errors,
      lenient.graph.nodes.filter((n) => n.opaque).length,
    ]).toEqual(['opaque', 'runtime.ts', 24, [], 1])
  })

  it('clean projects yield no errors', () => {
    expect(located('kit-app')).toEqual([])
    expect(located('core-app')).toEqual([])
    // An `Effect.Tag` class is a Tag: its Layers resolve to nodes named by its key.
    expect(located('effect-tag')).toEqual([])
    expect(
      analyze({ project: path.join(dir('effect-tag'), 'tsconfig.json') })
        .graphs[0]!.nodes.map((n) => n.id)
        .sort(),
    ).toEqual(['Clock', 'Logger'])
    // Each runtime checks only the actions its file reaches.
    expect(located('actions-roots')).toEqual(expected('actions-roots'))
    expect(
      analyze({ project: path.join(dir('actions-roots'), 'tsconfig.json') }).extraction.map((e) => e.code),
    ).toEqual(['UnownedAction'])
  })
})
