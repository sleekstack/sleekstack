/**
 * Equivalence harness (fn-9 task 7): runtime behaviors recorded before `buildGraph` was replaced by the
 * internal ResolutionPlan, asserted unchanged after. Plus: the root plan validates nothing, while the
 * dynamic-boundary path (child scopes) still throws.
 */
import { describe, expect, it } from 'vitest'
import { Cause, Context, Effect, Exit } from 'effect'
import { buildPlan } from '../graph'
import { makeAppScope, module, privateDependencyOf, service, type Entry, type Module } from '../index'

class A extends Context.Tag('A')<A, string>() {}
class B extends Context.Tag('B')<B, string>() {}
class C extends Context.Tag('C')<C, string>() {}
class Rq extends Context.Tag('Rq')<Rq, string>() {}

const appOf = (xs: readonly (Module | Entry)[]) => makeAppScope(xs)
const run = <T>(e: Effect.Effect<T, unknown>) => Effect.runPromise(e)
const fails = async (e: Effect.Effect<unknown, unknown>) => {
  const exit = await Effect.runPromiseExit(Effect.suspend(() => e))
  return Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
}
const logged = (log: string[], tag: Context.Tag<any, string>, name: string, requires: readonly Context.Tag<any, any>[] = [], lifetime?: 'request') =>
  service(tag, { requires, ...(lifetime && { lifetime }) }, () =>
    Effect.acquireRelease(Effect.sync(() => (log.push(`+${name}`), name)), () => Effect.sync(() => void log.push(`-${name}`))))

describe('runtime equivalence', () => {
  it('builds dependencies first in any listing order; finalizes in reverse', async () => {
    const log: string[] = []
    const app = await run(appOf([logged(log, C, 'C', [B]), logged(log, B, 'B', [A]), logged(log, A, 'A')]))
    expect(log).toEqual(['+A', '+B', '+C'])
    await run(app.close)
    expect(log).toEqual(['+A', '+B', '+C', '-C', '-B', '-A'])
  })

  it('shadowing: root entry > module entry > imported entry', async () => {
    const v = (x: string) => service(A, {}, () => Effect.succeed(x))
    const Lib = module({ name: 'Lib', entries: [v('lib')] })
    const App = module({ name: 'App', entries: [v('app')], imports: [Lib] })
    expect(Context.get((await run(appOf([module({ name: 'Only', imports: [Lib] })]))).context, A)).toBe('lib')
    expect(Context.get((await run(appOf([App]))).context, A)).toBe('app')
    expect(Context.get((await run(appOf([App, v('root')]))).context, A)).toBe('root')
  })

  it('private Tags are hidden from the public context and reported as PrivateDependency', async () => {
    const Data = module({ name: 'Data', entries: [service(A, {}, () => Effect.succeed('a')), service(B, { requires: [A] }, ([a]) => Effect.succeed(a + 'b'))], exports: [B] })
    const app = await run(appOf([Data]))
    expect(Context.get(app.context, B)).toBe('ab')
    expect(Context.getOption(app.context, A)._tag).toBe('None')
    expect(privateDependencyOf(app.context, 'A', 'x')).toMatchObject({ _tag: 'PrivateDependency', tag: 'A', module: 'Data' })
  })

  it('request nodes build per child scope over the app instance', async () => {
    const log: string[] = []
    const app = await run(appOf([logged(log, A, 'A'), logged(log, Rq, 'Rq', [A], 'request')]))
    const req = await run(app.child('request'))
    expect(Context.get(req.context, Rq)).toBe('Rq')
    await run(req.close)
    expect(log).toEqual(['+A', '+Rq', '-Rq'])
  })

  it('dynamic boundary (child scope entries) throws AmbiguousProvider, DependencyCycle, MissingDependency', async () => {
    const app = await run(appOf([]))
    const same = (x: string) => module({ name: x, entries: [service(A, { lifetime: 'request' }, () => Effect.succeed(x))] })
    expect(await fails(app.child('request', [same('L1'), same('L2')]))).toMatchObject({ _tag: 'AmbiguousProvider', tag: 'A', modules: ['L1', 'L2'] })
    const a = service(A, { requires: [B] }, () => Effect.succeed(''))
    const b = service(B, { requires: [A] }, () => Effect.succeed(''))
    expect(await fails(app.child('request', [a, b]))).toMatchObject({ _tag: 'DependencyCycle' })
    expect(await fails(app.child('request', [a]))).toMatchObject({ _tag: 'MissingDependency', service: 'A', missing: 'B' })
  })

  it('the root plan validates nothing: ambiguity, missing, private, captive and cycles all resolve', () => {
    const same = (x: string) => module({ name: x, entries: [service(A, {}, () => Effect.succeed(x))] })
    const Data = module({ name: 'Data', entries: [service(B, {}, () => Effect.succeed('b'))], exports: [] })
    const plan = buildPlan([
      module({ name: 'App', imports: [same('L1'), same('L2'), Data] }),
      service(C, { requires: [Rq, B] }, () => Effect.succeed('')), // captive + private
      service(Rq, { requires: [C], lifetime: 'request' }, () => Effect.succeed('')), // cycle
      service(class Z extends Context.Tag('Z')<Z, string>() {}, { requires: [class M extends Context.Tag('M')<M, string>() {}] }, () => Effect.succeed('')),
    ])
    expect(plan.nodes.map((n) => n.id).sort()).toEqual(['A', 'B', 'C', 'Rq', 'Z'])
    expect(plan.nodes.find((n) => n.id === 'A')!.module?.name).toBe('L1') // first listed wins
  })

  it('a root service cycle fails the build (lazy backstop) with DependencyCycle', async () => {
    const a = service(A, { requires: [B] }, () => Effect.succeed(''))
    const b = service(B, { requires: [A] }, () => Effect.succeed(''))
    expect(await fails(appOf([a, b]))).toMatchObject({ _tag: 'DependencyCycle' })
  })
})
