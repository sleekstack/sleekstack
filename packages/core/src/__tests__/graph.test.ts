import { describe, expect, it } from 'vitest'
import { Cause, Context, Effect, Exit, Layer } from 'effect'
import { declareLayer, makeAppScope, module, type Entry, type Module } from '../index'
import { service } from './helpers'

class Config extends Context.Tag('Config')<Config, string>() {}
class Db extends Context.Tag('Db')<Db, string>() {}
class Repo extends Context.Tag('Repo')<Repo, string>() {}
class Raw extends Context.Tag('Raw')<Raw, string>() {}

const ConfigDef = service(Config, {}, () => Effect.succeed('cfg'))
const ctx = async (xs: readonly (Module | Entry)[]) => (await Effect.runPromise(makeAppScope(xs))).context

// Build-time graph errors (missing, cycle, ambiguity, captive, privacy) are the analyzer's: packages/analyze fixtures.
describe('root resolution', () => {
  it('builds in position order: an entry sees the ones listed before it', async () => {
    const DbDecl = declareLayer(
      Layer.effect(
        Db,
        Effect.map(Config, (c) => `db(${c})`),
      ),
    )
    const RepoDef = service(Repo, { requires: [Db] }, ([db]) => Effect.succeed(`repo(${db})`))
    expect(Context.get(await ctx([ConfigDef, DbDecl, RepoDef]), Repo)).toBe('repo(db(cfg))')
  })

  it('a dependency listed after its dependent fails with MissingDependency', async () => {
    const DbDecl = declareLayer(
      Layer.effect(
        Db,
        Effect.map(Config, (c) => `db(${c})`),
      ),
    )
    const exit = await Effect.runPromiseExit(makeAppScope([DbDecl, ConfigDef]))
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toMatchObject({
      _tag: 'MissingDependency',
      missing: 'Config',
    })
  })

  it('imports build before their importer, deepest first', async () => {
    const Lib = module({ name: 'Lib', entries: [ConfigDef] })
    const App = module({
      name: 'App',
      imports: [Lib],
      entries: [
        declareLayer(
          Layer.effect(
            Db,
            Effect.map(Config, (c) => `db(${c})`),
          ),
        ),
      ],
    })
    expect(Context.get(await ctx([App]), Db)).toBe('db(cfg)')
  })

  it('bare Layers are built as a base', async () => {
    expect(Context.get(await ctx([Layer.succeed(Raw, 'raw'), ConfigDef]), Raw)).toBe('raw')
  })

  it('local entry shadows imported one; a root entry shadows a module entry', async () => {
    const Local = service(Config, {}, () => Effect.succeed('local'))
    const App = module({ name: 'App', entries: [Local], imports: [module({ name: 'Lib', entries: [ConfigDef] })] })
    expect(Context.get(await ctx([App]), Config)).toBe('local')
    expect(Context.get(await ctx([App, service(Config, {}, () => Effect.succeed('test'))]), Config)).toBe('test')
  })

  it('a later entry shadows one Tag of a multi-Tag Layer; the Layer still provides the rest', async () => {
    let built = 0
    const Both = declareLayer(
      Layer.effectContext(Effect.sync(() => (built++, Context.make(Db, 'd').pipe(Context.add(Repo, 'r'))))),
      {},
    )
    const c = await ctx([module({ name: 'Lib', entries: [Both] }), service(Db, {}, () => Effect.succeed('local'))])
    expect([Context.get(c, Db), Context.get(c, Repo)]).toEqual(['local', 'r'])
    expect(built).toBe(1)
  })

  it('raw-Layer construction failure names the owning module and keeps the original Cause', async () => {
    const NeedsRepo = declareLayer(Layer.effect(Db, Repo))
    const exit = await Effect.runPromiseExit(makeAppScope([module({ name: 'OwningModule', entries: [NeedsRepo] })]))
    const e = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
    expect((e as Error).message).toMatch(/module "OwningModule".*Service not found: Repo/)
    expect(Cause.isCause((e as Error).cause)).toBe(true)
  })

  it('diamond whose shared module provides a Tag is built once', async () => {
    let made = 0
    const Shared = module({
      name: 'Shared',
      entries: [service(Config, {}, () => Effect.sync(() => `n${++made}`))],
      exports: [Config],
    })
    const c = await ctx([
      module({
        name: 'App',
        imports: [module({ name: 'B', imports: [Shared] }), module({ name: 'C', imports: [Shared] })],
      }),
    ])
    expect(Context.get(c, Config)).toBe('n1')
    expect(made).toBe(1)
  })
})
