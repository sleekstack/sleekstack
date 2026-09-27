import { describe, expect, it } from 'vitest'
import { Context, Effect, Layer } from 'effect'
import {
  AmbiguousProvider, buildGraph, declareLayer, DependencyCycle, MissingDependency, module, service, snapshot,
} from '../index'

class Config extends Context.Tag('Config')<Config, string>() {}
class Db extends Context.Tag('Db')<Db, string>() {}
class Repo extends Context.Tag('Repo')<Repo, string>() {}
class Raw extends Context.Tag('Raw')<Raw, string>() {}

const ConfigDef = service(Config, {}, () => Effect.succeed('cfg'))
const err = (f: () => unknown) => { try { f() } catch (e) { return e } throw new Error('did not throw') }
const run = <A, I>(g: { layer: Layer.Layer<any, any, never> }, tag: Context.Tag<I, A>) =>
  Effect.runPromise(Effect.provide(tag, g.layer) as Effect.Effect<A>)

describe('buildGraph', () => {
  it('orders service -> declared Layer and declared Layer -> service, in any listing order', async () => {
    // Db is a declared raw Layer needing Config (a service); Repo is a service needing Db
    const DbDecl = declareLayer(Layer.effect(Db, Effect.map(Config, (c) => `db(${c})`)), { provides: [Db], requires: [Config] })
    const RepoDef = service(Repo, { requires: [Db] }, ([db]) => Effect.succeed(`repo(${db})`))
    const g = buildGraph([RepoDef, DbDecl, ConfigDef])
    expect(g.nodes.map((n) => n.id)).toEqual(['Config', 'Db', 'Repo'])
    expect(await run(g, Repo)).toBe('repo(db(cfg))')
  })

  it('service requiring a Tag only a bare Layer provides -> MissingDependency with declareLayer hint', async () => {
    const RawLayer = Layer.succeed(Raw, 'raw')
    const Uses = service(Repo, { requires: [Raw] }, ([r]) => Effect.succeed(r))
    const e = err(() => buildGraph([module({ name: 'Data', entries: [RawLayer, Uses] })]))
    expect(e).toBeInstanceOf(MissingDependency)
    expect((e as MissingDependency).message).toBe(
      'Service "Repo" (module "Data") requires "Raw", but no entry provides it. ' +
        'If a raw Layer provides it, wrap it with declareLayer(layer, { provides: [...] }).',
    )
    // bare Layers are still built, as a base
    expect(await run(buildGraph([RawLayer, ConfigDef]), Raw)).toBe('raw')
  })

  it('dependency cycle -> DependencyCycle with Tag path', () => {
    const DbDef = service(Db, { requires: [Repo] }, () => Effect.succeed(''))
    const RepoDef = service(Repo, { requires: [Db] }, () => Effect.succeed(''))
    expect((err(() => buildGraph([DbDef, RepoDef])) as DependencyCycle).path).toEqual(['Db', 'Repo', 'Db'])
  })

  it('local entry shadows imported one; shadowing is recorded', async () => {
    const Local = service(Config, {}, () => Effect.succeed('local'))
    const Lib = module({ name: 'Lib', entries: [ConfigDef] })
    const App = module({ name: 'App', entries: [Local], imports: [Lib] })
    const g = buildGraph([App])
    expect(await run(g, Config)).toBe('local')
    expect(g.shadowing).toEqual([{ tag: 'Config', winner: 'Config', shadowed: ['Config@Lib'] }])
    // a root entry shadows App's entry too
    const Test = service(Config, {}, () => Effect.succeed('test'))
    expect(await run(buildGraph([App, Test]), Config)).toBe('test')
  })

  it('same Tag at the same precedence -> AmbiguousProvider naming both modules', () => {
    const A = module({ name: 'A', entries: [ConfigDef] })
    const B = module({ name: 'B', entries: [service(Config, {}, () => Effect.succeed('b'))] })
    const e = err(() => buildGraph([module({ name: 'App', imports: [A, B] })]))
    expect(e).toBeInstanceOf(AmbiguousProvider)
    expect((e as AmbiguousProvider).modules).toEqual(['A', 'B'])
  })

  it('diamond whose shared module provides a Tag is deduped; provenance lists both paths', () => {
    const Shared = module({ name: 'Shared', entries: [ConfigDef], exports: [Config] })
    const B = module({ name: 'B', imports: [Shared] })
    const C = module({ name: 'C', imports: [Shared] })
    const g = buildGraph([module({ name: 'App', imports: [B, C] })])
    expect(g.nodes).toHaveLength(1)
    expect(g.nodes[0]!.paths).toEqual([['App', 'B', 'Shared'], ['App', 'C', 'Shared']])
  })

  it('snapshot round-trips through JSON with nodes/edges/lifetimes/provenance/opaque/private', () => {
    const RepoDef = service(Repo, { requires: [Config] }, ([c]) => Effect.succeed(c))
    const Lib = module({ name: 'Lib', entries: [ConfigDef, RepoDef, Layer.succeed(Raw, 'r')], exports: [Repo], lifetime: 'request' })
    const Override = service(Config, { lifetime: 'app' }, () => Effect.succeed('o'))
    const snap = snapshot(buildGraph([Lib, Override]))
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap)
    const lib = { id: 'Lib', name: 'Lib' }
    const paths = [['Lib']]
    expect(snap).toEqual({
      nodes: [
        { id: 'opaque:Lib#0', name: 'opaque:Lib#0', provides: [], lifetime: 'request', module: lib, paths, private: true, opaque: true, shadowed: false },
        { id: 'Config', name: 'Config', provides: ['Config'], lifetime: 'app', module: null, paths: [[]], private: false, opaque: false, shadowed: false },
        { id: 'Repo', name: 'Repo', provides: ['Repo'], lifetime: 'request', module: lib, paths, private: false, opaque: false, shadowed: false },
        { id: 'Config@Lib', name: 'Config', provides: ['Config'], lifetime: 'request', module: lib, paths, private: true, opaque: false, shadowed: true },
      ],
      edges: [{ from: 'Repo', to: 'Config', tag: 'Config' }],
      shadowing: [{ tag: 'Config', winner: 'Config', shadowed: ['Config@Lib'] }],
    })
  })
})
