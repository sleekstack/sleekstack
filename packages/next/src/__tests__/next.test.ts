import { describe, expect, it } from 'vitest'
import { Cause, Context, Effect } from 'effect'
import { service } from '@sleekstack/core'
import { action, configureRuntime, query } from '../index'

// This file's tests share one process-global runtime slot (by design, R8), so
// order matters: the "unconfigured" case runs first, before any configureRuntime call.

describe('@sleekstack/next', () => {
  it('unconfigured call throws a descriptive error', async () => {
    const op = action(() => Effect.succeed('ok'))
    await expect(op()).rejects.toThrow(/configureRuntime/)
  })

  it('finalizes the request scope after success, after typed failure, and after defect', async () => {
    const log: string[] = []
    class Tracked extends Context.Tag('next-test/Tracked')<Tracked, { n: number }>() {}
    let n = 0
    const tracked = service(Tracked, { lifetime: 'request' }, () =>
      Effect.acquireRelease(Effect.sync(() => ({ n: ++n })), (v) => Effect.sync(() => void log.push(`close:${v.n}`))))
    configureRuntime({ provide: [tracked] })

    const succeed = action(() => Effect.gen(function* () {
      yield* Tracked
      return 'ok'
    }))
    const fail = action(() => Effect.gen(function* () {
      yield* Tracked
      return yield* Effect.fail(new Error('typed failure'))
    }))
    const defect = action(() => Effect.gen(function* () {
      yield* Tracked
      return yield* Effect.die(new Error('defect'))
    }))

    await expect(succeed()).resolves.toBe('ok')
    await expect(fail()).rejects.toThrow()
    await expect(defect()).rejects.toThrow()
    expect(log).toEqual(['close:1', 'close:2', 'close:3'])
  })

  it('forwards arguments to fn; typed failure rejects with an Error whose cause holds the Effect Cause', async () => {
    configureRuntime({ provide: [] })
    const add = action((a: number, b: number) => Effect.succeed(a + b))
    await expect(add(2, 3)).resolves.toBe(5)

    const boom = action((msg: string) => Effect.fail(new Error(msg)))
    await expect(boom('kaboom')).rejects.toMatchObject({
      cause: expect.any(Object),
    })
    try {
      await boom('kaboom')
      expect.fail('expected rejection')
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
      expect(Cause.isCause((err as Error).cause)).toBe(true)
    }
  })

  it('calling the same action twice opens two distinct request scopes', async () => {
    class Rq extends Context.Tag('next-test/Rq')<Rq, { id: number }>() {}
    let n = 0
    const rq = service(Rq, { lifetime: 'request' }, () => Effect.sync(() => ({ id: ++n })))
    configureRuntime({ provide: [rq] })

    const readId = query(() => Effect.gen(function* () {
      const r = yield* Rq
      return r.id
    }))
    const [first, second] = [await readId(), await readId()]
    expect(first).not.toBe(second)
  })

  it('20 concurrent actions never share a request-scoped instance', async () => {
    class Rq extends Context.Tag('next-test/Rq20')<Rq, { id: number }>() {}
    let n = 0
    const rq = service(Rq, { lifetime: 'request' }, () => Effect.sync(() => ({ id: ++n })))
    configureRuntime({ provide: [rq] })

    const readId = action(() => Effect.gen(function* () {
      const r = yield* Rq
      return r.id
    }))
    const ids = await Promise.all(Array.from({ length: 20 }, () => readId()))
    expect(new Set(ids).size).toBe(20)
  })

  it('per-op provide affects only that op', async () => {
    class Svc extends Context.Tag('next-test/Svc')<Svc, { label: string }>() {}
    const global = service(Svc, {}, () => Effect.succeed({ label: 'global' }))
    configureRuntime({ provide: [global] })

    const readLabel = action(() => Effect.gen(function* () {
      const s = yield* Svc
      return s.label
    }))
    const overridden = action(
      { provide: [service(Svc, {}, () => Effect.succeed({ label: 'local' }))] },
      () => Effect.gen(function* () {
        const s = yield* Svc
        return s.label
      }),
    )

    expect(await overridden()).toBe('local')
    expect(await readLabel()).toBe('global')
  })

  it('returning a ReadableStream or async iterable raises the descriptive error', async () => {
    configureRuntime({ provide: [] })
    const stream = action(() => Effect.succeed(new ReadableStream()))
    await expect(stream()).rejects.toThrow(/streaming results are not supported/)

    const asyncIterable = action(() =>
      Effect.succeed({
        async *[Symbol.asyncIterator]() {
          yield 1
        },
      }),
    )
    await expect(asyncIterable()).rejects.toThrow(/streaming results are not supported/)
  })

  it('re-configure with the same config is a no-op; a different config disposes the old app scope and uses new services', async () => {
    class Svc extends Context.Tag('next-test/ReconfigSvc')<Svc, { label: string }>() {}
    let built = 0
    const closeLog: string[] = []
    const makeConfig = (label: string) => ({
      provide: [
        service(Svc, {}, () =>
          Effect.acquireRelease(
            Effect.sync(() => (built++, { label })),
            () => Effect.sync(() => void closeLog.push(`close:${label}`)),
          )),
      ],
    })

    const config1 = makeConfig('one')
    configureRuntime(config1)
    configureRuntime(config1) // same reference: no-op

    const readLabel = action(() => Effect.gen(function* () {
      const s = yield* Svc
      return s.label
    }))
    expect(await readLabel()).toBe('one')
    expect(built).toBe(1)

    const config2 = makeConfig('two')
    configureRuntime(config2) // different reference: disposes config1's app scope, replaces it
    expect(await readLabel()).toBe('two')

    // Wait a tick for the disposed scope's finalizer (dispose() is fire-and-forget).
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(closeLog).toContain('close:one')
  })

  it('per-op provide of an app-lifetime service overrides the global instance for that op only', async () => {
    class AppSvc extends Context.Tag('next-test/AppSvc')<AppSvc, { n: number }>() {}
    const global = service(AppSvc, {}, () => Effect.succeed({ n: 1 }))
    configureRuntime({ provide: [global] })

    const readN = action(() => Effect.gen(function* () {
      const s = yield* AppSvc
      return s.n
    }))
    const overridden = action(
      { provide: [service(AppSvc, {}, () => Effect.succeed({ n: 99 }))] },
      () => Effect.gen(function* () {
        const s = yield* AppSvc
        return s.n
      }),
    )

    expect(await overridden()).toBe(99)
    expect(await readN()).toBe(1)
  })
})
