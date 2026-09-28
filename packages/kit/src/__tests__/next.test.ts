import { describe, expect, it } from 'vitest'
import { layer, module, tag, withCleanup, type FinalizerError } from '../index'
import { action, configureRuntime, fail, query } from '../next'

// One process-global runtime slot (next, by design): the unconfigured case must run first.

interface Rq { id: number }
const Rq = tag<Rq>('Rq')
interface Label { label: string }
const Label = tag<Label>('Label')

const caught = async (p: Promise<unknown>) => p.then(() => { throw new Error('resolved') }, (e) => e as Error & { code?: string; details?: Record<string, unknown> })

describe('@sleekstack/kit/next', () => {
  it('unconfigured runtime rejects with next\'s message', async () => {
    await expect(action(() => () => 1, [])()).rejects.toThrow(/configureRuntime/)
  })

  it('20 concurrent actions get distinct request instances; cleanups run after each call', async () => {
    const log: string[] = []
    let n = 0
    const rq = layer(Rq, () => { const v = { id: ++n }; return withCleanup(v, () => void log.push(`close:${v.id}`)) }, [], { lifetime: 'request' })
    configureRuntime({ provide: [rq] })
    const readId = action((r) => async () => { log.push(`run:${r.id}`); return r.id }, [Rq])
    await readId()
    expect(log).toEqual(['run:1', 'close:1'])
    const results = await Promise.all(Array.from({ length: 20 }, () => readId()))
    const ids = results.map((r) => (r.ok ? r.data : -1))
    expect(new Set(ids).size).toBe(20)
    expect(log.filter((l) => l.startsWith('close')).length).toBe(21)
  })

  it('fail resolves {ok:false}; throw rejects HandlerFailed; query fail rejects with its message', async () => {
    configureRuntime({ provide: [] })
    await expect(action(() => (x: number) => x + 1, [])(1)).resolves.toEqual({ ok: true, data: 2 })
    await expect(action(() => () => fail('nope'), [])()).resolves.toEqual({ ok: false, error: 'nope' })
    const e = await caught(action(() => async () => { throw new Error('boom') }, [])())
    expect(e).toMatchObject({ name: 'SleekStackError', code: 'HandlerFailed', message: 'boom' })
    await expect(query(() => () => fail('nope'), [])()).rejects.toThrow('nope')
    await expect(query(() => () => 7, [])()).resolves.toBe(7)
  })

  it('a missing dependency rejects MissingDependency', async () => {
    configureRuntime({ provide: [] })
    const e = await caught(action((r) => () => r.id, [Rq])())
    expect(e).toMatchObject({ code: 'MissingDependency', details: { tag: 'Rq' } })
  })

  it('stream returns reject through action and query', async () => {
    configureRuntime({ provide: [] })
    const iter = { async *[Symbol.asyncIterator]() { yield 1 } }
    for (const op of [action, query]) {
      await expect(op(() => () => new ReadableStream(), [])()).rejects.toThrow(/streaming results are not supported/)
      await expect(op(() => () => iter, [])()).rejects.toThrow(/streaming results are not supported/)
    }
  })

  it('opts.provide shadows per call (Layer and Module)', async () => {
    configureRuntime({ provide: [layer(Label, { label: 'global' })] })
    const read = (label: Label) => () => label.label
    const local = action(read, [Label], { provide: [layer(Label, { label: 'local' })] })
    const viaModule = action(read, [Label], { provide: [module({ name: 'Demo', provide: [layer(Label, { label: 'module' })] })] })
    expect(await local()).toEqual({ ok: true, data: 'local' })
    expect(await viaModule()).toEqual({ ok: true, data: 'module' })
    expect(await action(read, [Label])()).toEqual({ ok: true, data: 'global' })
    const Base = module({ name: 'Base', provide: [layer(Label, { label: 'imported' })] })
    const Over = module({ name: 'Over', imports: [Base], provide: [layer(Label, { label: 'override' })] })
    expect(await action(read, [Label], { provide: [Over] })()).toEqual({ ok: true, data: 'override' })
  })

  it('a request-Layer failure rejects as SleekStackError with code/details', async () => {
    configureRuntime({ provide: [layer(Rq, () => { throw new Error('db down') }, [], { lifetime: 'request' })] })
    const e = await caught(action((r) => () => r.id, [Rq])())
    expect(e).toMatchObject({ name: 'SleekStackError', code: 'LayerFailed', details: { tag: 'Rq', cause: 'db down' } })
  })

  it('duplicate Tag in configureRuntime or opts.provide throws DuplicateTag', () => {
    const a = layer(tag<Label>('Dup'), { label: 'a' })
    const b = layer(tag<Label>('Dup'), { label: 'b' })
    expect(() => configureRuntime({ provide: [a, b] })).toThrow(expect.objectContaining({ code: 'DuplicateTag' }))
    expect(() => action(() => () => 1, [], { provide: [a, b] })).toThrow(expect.objectContaining({ code: 'DuplicateTag' }))
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
    const read = action((l) => () => l.label, [Label])
    const first = await read()
    configureRuntime(app)
    expect(await read()).toEqual(first)

    configureRuntime(cfg)
    expect(await action((r) => () => r.id, [Rq])()).toMatchObject({ ok: true })
    expect(errs).toHaveLength(1)
    expect(Object.keys(errs[0]!)).toEqual(['message'])
    expect(errs[0]!.message).toMatch(/cleanup boom/)
  })
})
