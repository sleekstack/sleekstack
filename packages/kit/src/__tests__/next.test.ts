import { describe, expect, it, vi } from 'vitest'
import { devEvents } from '@sleekstack/runtime/internal'
import { Cause, Effect } from 'effect'
import { layer, module, tag, withCleanup, type FinalizerError } from '../index'
import { configureRuntime, defineEffect, effect, fail, query as runQuery, type OperationOptions } from '../next'
import type { AnyTag } from '../tag'
import type { Services } from '../layer'

// Positional-factory helpers over effect()/query(): each test body is a plain function of its resolved deps.
const body = <const D extends readonly AnyTag[], R>(f: (...deps: Services<D>) => R, deps: D) =>
  function* () {
    const resolved: unknown[] = []
    for (const t of deps) resolved.push(yield* (t as unknown as { [Symbol.iterator](): Generator<never, unknown, unknown> }))
    return yield* Effect.promise(async () => f(...(resolved as never)))
  }
const action = <const D extends readonly AnyTag[], R>(f: (...deps: Services<D>) => R, deps: D, opts?: OperationOptions) => effect(body(f, deps), opts)
const query = <const D extends readonly AnyTag[], R>(f: (...deps: Services<D>) => R, deps: D, opts?: OperationOptions) => runQuery(body(f, deps), opts)

// One process-global runtime slot (next, by design): the unconfigured case must run first.

interface Rq { id: number }
const Rq = tag<Rq>('Rq')
interface Label { label: string }
const Label = tag<Label>('Label')

const caught = async (p: Promise<unknown>) => p.then(() => { throw new Error('resolved') }, (e) => e as Error & { code?: string; details?: Record<string, unknown> })

describe('@sleekstack/kit/next', () => {
  it('unconfigured runtime rejects with next\'s message', async () => {
    await expect(action(() => 1, [])).rejects.toThrow(/configureRuntime/)
  })

  it('20 concurrent actions get distinct request instances; cleanups run after each call', async () => {
    const log: string[] = []
    let n = 0
    const rq = layer(Rq, () => { const v = { id: ++n }; return withCleanup(v, () => void log.push(`close:${v.id}`)) }, [], { lifetime: 'request' })
    configureRuntime({ provide: [rq] })
    const readId = (r: Rq) => { log.push(`run:${r.id}`); return r.id }
    await action(readId, [Rq])
    expect(log).toEqual(['run:1', 'close:1'])
    const results = await Promise.all(Array.from({ length: 20 }, () => action(readId, [Rq])))
    const ids = results.map((r) => (r.ok ? r.data : -1))
    expect(new Set(ids).size).toBe(20)
    expect(log.filter((l) => l.startsWith('close')).length).toBe(21)
  })

  it('fail resolves {ok:false}; throw rejects HandlerFailed; query fail rejects with its message', async () => {
    configureRuntime({ provide: [] })
    await expect(action(() => 1 + 1, [])).resolves.toEqual({ ok: true, data: 2 })
    await expect(action(() => fail('nope'), [])).resolves.toEqual({ ok: false, error: 'nope' })
    const e = await caught(action(async () => { throw new Error('boom') }, []))
    expect(e).toMatchObject({ name: 'SleekStackError', code: 'HandlerFailed', message: 'boom' })
    await expect(query(() => fail('nope'), [])).rejects.toThrow('nope')
    await expect(query(() => 7, [])).resolves.toBe(7)
  })

  it('handler data shaped like an old sentinel is returned as data; a thrown Error with a Cause is HandlerFailed', async () => {
    configureRuntime({ provide: [] })
    const shaped = { [Symbol('sleekstack.failed')]: 'x', ok: false, error: 'y' }
    await expect(action(() => shaped, [])).resolves.toEqual({ ok: true, data: shaped })
    const e = await caught(action(() => { throw new Error('user', { cause: Cause.fail('inner') }) }, []))
    expect(e).toMatchObject({ code: 'HandlerFailed', message: 'user' })
  })

  it('Next redirect/notFound thrown in a handler reach Next untouched (action and query)', async () => {
    configureRuntime({ provide: [] })
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/x;307;' })
    const notFound = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    await expect(action(() => { throw redirect }, [])).rejects.toBe(redirect)
    await expect(query(() => { throw notFound }, [])).rejects.toBe(notFound)
  })

  it('a missing dependency rejects MissingDependency', async () => {
    configureRuntime({ provide: [] })
    const e = await caught(action((r: Rq) => r.id, [Rq]))
    expect(e).toMatchObject({ code: 'MissingDependency', details: { tag: 'Rq' } })
  })

  it('app-lifetime factory throw/reject surfaces LayerFailed with the Tag via action and query', async () => {
    for (const impl of [() => { throw new Error('init boom') }, async () => { throw new Error('init boom') }]) {
      configureRuntime({ provide: [layer(Label, impl as unknown as () => Label)] })
      for (const op of [action, query]) {
        const e = await caught(op((l: Label) => l.label, [Label]))
        expect(e).toMatchObject({ name: 'SleekStackError', code: 'LayerFailed', details: { tag: 'Label' } })
        expect(e.message).toMatch(/init boom/)
      }
    }
  })

  it('a private action dependency rejects PrivateDependency', async () => {
    configureRuntime({ provide: [module({ name: 'Lib', provide: [layer(Label, () => ({ label: 'x' }))], exports: [] })] })
    const e = await caught(action((l: Label) => l.label, [Label]))
    expect(e).toMatchObject({ code: 'PrivateDependency', details: { tag: 'Label', module: 'Lib' } })
  })

  it('stream returns reject through action and query', async () => {
    configureRuntime({ provide: [] })
    const iter = { async *[Symbol.asyncIterator]() { yield 1 } }
    for (const op of [action, query]) {
      await expect(op(() => new ReadableStream(), [])).rejects.toThrow(/streaming results are not supported/)
      await expect(op(() => iter, [])).rejects.toThrow(/streaming results are not supported/)
    }
  })

  it('opts.provide shadows per call (Layer and Module)', async () => {
    configureRuntime({ provide: [layer(Label, { label: 'global' })] })
    const read = (label: Label) => label.label
    expect(await action(read, [Label], { provide: [layer(Label, { label: 'local' })] })).toEqual({ ok: true, data: 'local' })
    expect(await action(read, [Label], { provide: [module({ name: 'Demo', provide: [layer(Label, { label: 'module' })] })] })).toEqual({ ok: true, data: 'module' })
    expect(await action(read, [Label])).toEqual({ ok: true, data: 'global' })
    const Base = module({ name: 'Base', provide: [layer(Label, { label: 'imported' })] })
    const Over = module({ name: 'Over', imports: [Base], provide: [layer(Label, { label: 'override' })] })
    expect(await action(read, [Label], { provide: [Over] })).toEqual({ ok: true, data: 'override' })
  })

  it('a request-Layer failure rejects as SleekStackError with code/details', async () => {
    configureRuntime({ provide: [layer(Rq, () => { throw new Error('db down') }, [], { lifetime: 'request' })] })
    const e = await caught(action((r: Rq) => r.id, [Rq]))
    expect(e).toMatchObject({ name: 'SleekStackError', code: 'LayerFailed', details: { tag: 'Rq', cause: 'db down' } })
  })

  it('duplicate Tag in configureRuntime or opts.provide throws DuplicateTag', async () => {
    const a = layer(tag<Label>('Dup'), { label: 'a' })
    const b = layer(tag<Label>('Dup'), { label: 'b' })
    expect(() => configureRuntime({ provide: [a, b] })).toThrow(expect.objectContaining({ code: 'DuplicateTag' }))
    await expect(action(() => 1, [], { provide: [a, b] })).rejects.toThrow(expect.objectContaining({ code: 'DuplicateTag' }))
  })

  it('repeat configureRuntime with the same config is a no-op; finalizer errors are plain', async () => {
    let n = 0
    const errs: FinalizerError[] = []
    const cfg = {
      provide: [layer(Rq, () => withCleanup({ id: ++n }, () => { throw new Error('cleanup boom') }), [], { lifetime: 'request' })],
      onFinalizerError: (e: FinalizerError) => void errs.push(e),
    }
    const counter = layer(Label, () => ({ label: String(++n) }))
    const app = { provide: [counter], onFinalizerError: cfg.onFinalizerError }
    configureRuntime(app)
    const read = (l: Label) => l.label
    const first = await action(read, [Label])
    configureRuntime(app)
    expect(await action(read, [Label])).toEqual(first)

    configureRuntime(cfg)
    expect(await action((r: Rq) => r.id, [Rq])).toMatchObject({ ok: true })
    expect(errs).toHaveLength(1)
    expect(errs[0]).toEqual({ message: expect.stringMatching(/cleanup boom/), tag: 'Rq' })
    expect(errs[0]!.message).toMatch(/cleanup boom/)
  })

  describe('effect', () => {
    it('yield*-ing an unprovided Tag rejects MissingDependency', async () => {
      configureRuntime({ provide: [layer(Rq, () => ({ id: 1 }))] })
      const reaches = defineEffect(function* () {
        const rq = yield* Rq
        const label = yield* Label
        return `${rq.id}:${label.label}`
      })
      const e = await reaches().catch((err: unknown) => err)
      expect(e).toMatchObject({ name: 'SleekStackError', code: 'MissingDependency', details: { tag: 'Label' } })
    })

    it('opts.scope builds a never-yielded request Tag, so its open / close still run', async () => {
      const log: string[] = []
      configureRuntime({ provide: [layer(Rq, () => { log.push('open'); return withCleanup({ id: 1 }, () => void log.push('close')) }, [], { lifetime: 'request' })] })
      const run = defineEffect(function* () { log.push('body'); return 1 }, { scope: [Rq] })
      await expect(run()).resolves.toEqual({ ok: true, data: 1 })
      expect(log).toEqual(['open', 'body', 'close'])
    })

    it('composes with ordinary Effect operations inside the generator', async () => {
      configureRuntime({ provide: [layer(Rq, () => ({ id: 5 }))] })
      const doubled = defineEffect(function* () {
        const rq = yield* Rq
        return yield* Effect.succeed(rq.id * 2)
      })
      await expect(doubled()).resolves.toEqual({ ok: true, data: 10 })
    })

    it('defineEffect + effect: input flows in, fail() settles {ok:false}', async () => {
      configureRuntime({ provide: [layer(Rq, () => ({ id: 3 }))] })
      const readPlus = defineEffect(function* (n: number) {
        const rq = yield* Rq
        if (n < 0) fail('neg')
        return rq.id + n
      })
      await expect(readPlus(4)).resolves.toEqual({ ok: true, data: 7 })
      await expect(readPlus(-1)).resolves.toEqual({ ok: false, error: 'neg' })
    })
  })

  it('devtools: per-service acquire/release carry the Tag key, owning scope and fiber; production wraps nothing', async () => {
    const app = layer(Label, () => ({ label: 'x' }))
    const rq = layer(Rq, () => ({ id: 1 }), [], { lifetime: 'request' })
    configureRuntime({ provide: [module({ name: 'traced', provide: [app, rq] })] })
    await action((r: Rq) => r.id, [Rq])
    const services = devEvents().filter((e) => e.label === 'Label' || e.label === 'Rq')
    expect(services.map((e) => [e.kind, e.label, e.scope?.replace(/\d+$/, 'N')])).toEqual([
      ['acquire', 'Label', 'app'],
      ['acquire', 'Rq', 'request#N'],
      ['release', 'Rq', 'request#N'],
    ])
    expect(services.every((e) => typeof e.fiber === 'string')).toBe(true)

    vi.stubEnv('NODE_ENV', 'production')
    try {
      configureRuntime({ provide: [rq] })
      await action((r: Rq) => r.id, [Rq])
      expect(devEvents()).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
