import { describe, expect, it } from 'vitest'
import { Context, Effect, Exit, Layer, Scope } from 'effect'
import { service } from '../service'
import { DependencyCycle, MissingDependency, order, wire } from '../order'

class Config extends Context.Tag('Config')<Config, { url: string }>() {}
class Logger extends Context.Tag('Logger')<Logger, { log: (s: string) => string }>() {}
class Db extends Context.Tag('Db')<Db, { query: () => string }>() {}
class Repo extends Context.Tag('Repo')<Repo, { find: () => string }>() {}
class Api extends Context.Tag('Api')<Api, { handle: () => string }>() {}

const ConfigDef = service(Config, {}, () => Effect.succeed({ url: 'pg://x' }))
const LoggerDef = service(Logger, { requires: [Config] }, ([c]) =>
  Effect.succeed({ log: (s: string) => `[${c.url}] ${s}` }),
)
const DbDef = service(Db, { requires: [Config, Logger] }, ([c, l]) =>
  Effect.succeed({ query: () => l.log(`query ${c.url}`) }),
)
const RepoDef = service(Repo, { requires: [Db] }, ([db]) => Effect.succeed({ find: () => db.query() }))
const ApiDef = service(Api, { requires: [Repo, Logger] }, ([r, l]) =>
  Effect.succeed({ handle: () => l.log(r.find()) }),
)

describe('spike: hybrid service definitions', () => {
  it('5 services in arbitrary order build and resolve', async () => {
    const layer = wire([ApiDef, RepoDef, ConfigDef, DbDef, LoggerDef])
    const out = await Effect.runPromise(
      Effect.map(Api, (a) => a.handle()).pipe(Effect.provide(layer)) as Effect.Effect<string>,
    )
    expect(out).toBe('[pg://x] [pg://x] query pg://x')
    expect(order([ApiDef, RepoDef, ConfigDef, DbDef, LoggerDef]).map((d) => d.tag.key)).toEqual([
      'Config', 'Logger', 'Db', 'Repo', 'Api',
    ])
  })

  it('missing dependency names requiring service and missing Tag', () => {
    let err: unknown
    try { order([ApiDef, RepoDef, ConfigDef, LoggerDef]) } catch (e) { err = e }
    expect(err).toBeInstanceOf(MissingDependency)
    expect((err as MissingDependency).message).toBe('Service "Repo" requires "Db", but no entry provides it')
  })

  it('A requires B, B requires A -> DependencyCycle with path', () => {
    class A extends Context.Tag('A')<A, 1>() {}
    class B extends Context.Tag('B')<B, 2>() {}
    const ADef = service(A, { requires: [B] }, () => Effect.succeed(1 as const))
    const BDef = service(B, { requires: [A] }, () => Effect.succeed(2 as const))
    let err: unknown
    try { order([ConfigDef, ADef, BDef]) } catch (e) { err = e }
    expect(err).toBeInstanceOf(DependencyCycle)
    expect((err as DependencyCycle).path).toEqual(['A', 'B', 'A'])
  })

  it('scoped acquire/release is finalized when the scope closes', async () => {
    const events: string[] = []
    class Res extends Context.Tag('Res')<Res, string>() {}
    const ResDef = service(Res, {}, () =>
      Effect.acquireRelease(Effect.sync(() => (events.push('acquire'), 'r')), () =>
        Effect.sync(() => events.push('release')),
      ),
    )
    await Effect.runPromise(
      Effect.gen(function* () {
        const scope = yield* Scope.make()
        const ctx = yield* Layer.buildWithScope(wire([ResDef]), scope)
        expect(Context.unsafeGet(ctx, Res)).toBe('r')
        expect(events).toEqual(['acquire'])
        yield* Scope.close(scope, Exit.void)
      }),
    )
    expect(events).toEqual(['acquire', 'release'])
  })
})
