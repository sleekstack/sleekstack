import { describe, expect, it } from 'vitest'
import { Cause, Context, Effect, Exit, Layer } from 'effect'
import { declareLayer, makeAppScope, module, service, type Entry, type Module } from '../index'

class Config extends Context.Tag('Config')<Config, string>() {}
class Db extends Context.Tag('Db')<Db, string>() {}
class Repo extends Context.Tag('Repo')<Repo, string>() {}
class Raw extends Context.Tag('Raw')<Raw, string>() {}

const ConfigDef = service(Config, {}, () => Effect.succeed('cfg'))
const ctx = async (xs: readonly (Module | Entry)[]) => (await Effect.runPromise(makeAppScope(xs))).context

// Build-time graph errors (missing, cycle, ambiguity, captive, privacy) are the analyzer's: packages/analyze fixtures.
describe('root resolution', () => {
  it('orders service -> declared Layer and declared Layer -> service, in any listing order', async () => {
    const DbDecl = declareLayer(Layer.effect(Db, Effect.map(Config, (c) => `db(${c})`)), { provides: [Db], requires: [Config] })
    const RepoDef = service(Repo, { requires: [Db] }, ([db]) => Effect.succeed(`repo(${db})`))
    expect(Context.get(await ctx([RepoDef, DbDecl, ConfigDef]), Repo)).toBe('repo(db(cfg))')
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

  it('declared Layer shadowed on only some of its Tags: local wins that Tag, the Layer still provides the rest', async () => {
    let built = 0
    const Both = declareLayer(Layer.effectContext(Effect.sync(() => (built++, Context.make(Db, 'd').pipe(Context.add(Repo, 'r'))))), { provides: [Db, Repo] })
    const c = await ctx([module({ name: 'Lib', entries: [Both] }), service(Db, {}, () => Effect.succeed('local'))])
    expect([Context.get(c, Db), Context.get(c, Repo)]).toEqual(['local', 'r'])
    expect(built).toBe(1)
  })

  it('raw-Layer construction failure names the owning module and keeps the original Cause', async () => {
    const NeedsRepo = declareLayer(Layer.effect(Db, Repo), { provides: [Db] })
    const exit = await Effect.runPromiseExit(makeAppScope([module({ name: 'OwningModule', entries: [NeedsRepo] })]))
    const e = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
    expect((e as Error).message).toMatch(/module "OwningModule".*Service not found: Repo/)
    expect(Cause.isCause((e as Error).cause)).toBe(true)
  })

  it('diamond whose shared module provides a Tag is built once', async () => {
    let made = 0
    const Shared = module({ name: 'Shared', entries: [service(Config, {}, () => Effect.sync(() => `n${++made}`))], exports: [Config] })
    const c = await ctx([module({ name: 'App', imports: [module({ name: 'B', imports: [Shared] }), module({ name: 'C', imports: [Shared] })] })])
    expect(Context.get(c, Config)).toBe('n1')
    expect(made).toBe(1)
  })
})
