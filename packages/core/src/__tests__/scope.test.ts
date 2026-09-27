import { describe, expect, it } from 'vitest'
import { Cause, Context, Deferred, Effect, Exit, Fiber } from 'effect'
import { buildGraph, makeAppScope, module, service } from '../index'

class A extends Context.Tag('A')<A, { n: number }>() {}
class B extends Context.Tag('B')<B, { n: number }>() {}
class Rq extends Context.Tag('Rq')<Rq, { n: number; a: { n: number } }>() {}
class X extends Context.Tag('X')<X, { n: number }>() {}
class Y extends Context.Tag('Y')<Y, { n: number }>() {}

const run = <T>(e: Effect.Effect<T, unknown>) => Effect.runPromise(e)

describe('scope runtime', () => {
  it('builds a shared service once per scope', async () => {
    let made = 0
    const a = service(A, {}, () => Effect.sync(() => ({ n: ++made })))
    const b = service(B, { requires: [A] }, ([x]) => Effect.succeed(x))
    const r = service(Rq, { requires: [A, B], lifetime: 'request' }, ([x]) => Effect.succeed({ n: 0, a: x }))
    const app = await run(makeAppScope(buildGraph([a, b, r])))
    await run(app.child('request'))
    expect(made).toBe(1)
  })

  it('child scopes get distinct child instances and the same app instance', async () => {
    let n = 0
    const a = service(A, {}, () => Effect.succeed({ n: -1 }))
    const r = service(Rq, { requires: [A], lifetime: 'request' }, ([x]) => Effect.sync(() => ({ n: ++n, a: x })))
    const app = await run(makeAppScope(buildGraph([a, r])))
    const [c1, c2] = await run(Effect.all([app.child('request'), app.child('request')]))
    const r1 = Context.get(c1!.context, Rq), r2 = Context.get(c2!.context, Rq)
    expect(r1).not.toBe(r2)
    expect(r1.a).toBe(r2.a)
    expect(r1.a).toBe(Context.get(app.context, A))
  })

  const tracked = (log: string[], fail?: string) => (tag: Context.Tag<any, { n: number }>, name: string, requires: readonly Context.Tag<any, any>[] = []) =>
    service(tag, { requires }, () =>
      Effect.acquireRelease(Effect.sync(() => (log.push(`+${name}`), { n: 0 })), () =>
        name === fail ? Effect.die(`${name} failed`) : Effect.sync(() => void log.push(`-${name}`))))

  it('finalizes in reverse order; a failing finalizer does not stop the rest', async () => {
    const log: string[] = []
    const t = tracked(log, 'B')
    const app = await run(makeAppScope(buildGraph([t(A, 'A'), t(B, 'B', [A]), t(X, 'X', [B])])))
    const exit = await run(app.close)
    expect(log).toEqual(['+A', '+B', '+X', '-X', '-A'])
    expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain('B failed')
  })

  it('dispose reports finalizer failures to onFinalizerError', async () => {
    const t = tracked([], 'A')
    const seen = await new Promise<Cause.Cause<unknown>>((resolve) =>
      run(makeAppScope(buildGraph([t(A, 'A')]), { onFinalizerError: resolve })).then((s) => s.dispose()))
    expect(Cause.pretty(seen)).toContain('A failed')
  })

  it('construction failure on the 3rd of 4 finalizes the first 2', async () => {
    const log: string[] = []
    const t = tracked(log)
    const bad = service(X, { requires: [B] }, () => Effect.fail('boom'))
    const y = service(Y, { requires: [X] }, () => Effect.succeed({ n: 0 }))
    const exit = await Effect.runPromiseExit(makeAppScope(buildGraph([t(A, 'A'), t(B, 'B', [A]), bad, y])))
    expect(Exit.isFailure(exit)).toBe(true)
    expect(log).toEqual(['+A', '+B', '-B', '-A'])
  })

  it('child-boundary entry shadows the parent instance only inside that child', async () => {
    const a = service(A, {}, () => Effect.succeed({ n: 1 }))
    const r = service(Rq, { requires: [A], lifetime: 'request' }, ([x]) => Effect.succeed({ n: 0, a: x }))
    const app = await run(makeAppScope(buildGraph([a, r])))
    const local = await run(app.child('request', [service(A, {}, () => Effect.succeed({ n: 2 }))]))
    const plain = await run(app.child('request'))
    expect(Context.get(local.context, A).n).toBe(2)
    expect(Context.get(local.context, Rq).a.n).toBe(2)
    expect(Context.get(plain.context, Rq).a.n).toBe(1)
    expect(Context.get(app.context, A).n).toBe(1)
  })

  it('child-boundary modules are resolved through imports and thunks', async () => {
    const app = await run(makeAppScope(buildGraph([])))
    const Leaf = module({ name: 'Leaf', entries: [service(B, {}, () => Effect.succeed({ n: 7 }))] })
    const Mid = module({ name: 'Mid', imports: () => [Leaf] })
    const child = await run(app.child('request', [module({ name: 'Top', imports: [Mid] })]))
    expect(Context.get(child.context, B).n).toBe(7)
  })

  it('an interrupted build finalizes what it acquired and does not hang later builds', async () => {
    const log: string[] = []
    let calls = 0
    const gate = await run(Deferred.make<void>())
    const b = service(B, { lifetime: 'request' }, () =>
      Effect.acquireRelease(Effect.sync(() => (log.push('+B'), { n: 0 })), () => Effect.sync(() => void log.push('-B'))))
    const x = service(X, { requires: [B], lifetime: 'request' }, () =>
      ++calls === 1 ? Deferred.succeed(gate, undefined).pipe(Effect.zipRight(Effect.never)) : Effect.succeed({ n: 1 }))
    const app = await run(makeAppScope(buildGraph([b, x])))
    const fiber = Effect.runFork(app.child('request'))
    await run(Deferred.await(gate))
    await run(Fiber.interrupt(fiber))
    expect(log).toEqual(['+B', '-B'])
    const next = await run(app.child('request').pipe(Effect.timeout('1 second')))
    expect(Context.get(next.context, X).n).toBe(1)
  })

  it('nested same-lifetime scopes own distinct instances and finalize independently', async () => {
    const log: string[] = []
    let n = 0
    const a = service(A, {}, () => Effect.succeed({ n: -1 }))
    const c = service(Rq, { requires: [A], lifetime: 'component' }, ([x]) =>
      Effect.acquireRelease(Effect.sync(() => ({ n: ++n, a: x })), (v) => Effect.sync(() => void log.push(`-${v.n}`))))
    const app = await run(makeAppScope(buildGraph([a, c])))
    const outer = await run(app.child('component'))
    const inner = await run(outer.child('component'))
    const o = Context.get(outer.context, Rq), i = Context.get(inner.context, Rq)
    expect(i).not.toBe(o)
    expect(i.a).toBe(o.a)
    await run(inner.close)
    expect(log).toEqual([`-${i.n}`])
  })

  it('rejects duplicate providers among boundary entries', async () => {
    const app = await run(makeAppScope(buildGraph([])))
    const dup = () => service(A, {}, () => Effect.succeed({ n: 0 }))
    const exit = await Effect.runPromiseExit(app.child('request', [dup(), dup()]))
    expect(Exit.isFailure(exit) && Cause.pretty(exit.cause)).toContain('AmbiguousProvider')
  })

  it('rejects opening a request scope inside a component scope', async () => {
    const app = await run(makeAppScope(buildGraph([])))
    const comp = await run(app.child('component'))
    const exit = await Effect.runPromiseExit(comp.child('request'))
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
