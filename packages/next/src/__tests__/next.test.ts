import { describe, expect, it } from 'vitest'
import { Context, Effect } from 'effect'
import { service } from '@sleekstack/core'
import { configureRuntime, runEffect } from '../index'

// `configureRuntime({ provide })` (the kit path): runEffect opens a core request scope per call,
// with the internal `provide` option built into it. One process-global runtime slot, so tests share it.

describe('@sleekstack/next provide config', () => {
  it('closes the request scope after success, typed failure and defect', async () => {
    const log: string[] = []
    class Tracked extends Context.Tag('next-test/Tracked')<Tracked, { n: number }>() {}
    let n = 0
    const tracked = service(Tracked, { lifetime: 'request' }, () =>
      Effect.acquireRelease(Effect.sync(() => ({ n: ++n })), (v) => Effect.sync(() => void log.push(`close:${v.n}`))))
    configureRuntime({ provide: [tracked], onError: () => {} })

    const use = <A, E>(tail: Effect.Effect<A, E>) => runEffect(Effect.flatMap(Tracked, () => tail))
    await expect(use(Effect.succeed('ok'))).resolves.toBe('ok')
    await expect(use(Effect.fail(new Error('typed failure')))).rejects.toThrow()
    await expect(use(Effect.die(new Error('defect')))).rejects.toThrow()
    expect(log).toEqual(['close:1', 'close:2', 'close:3'])
  })

  it('20 concurrent calls never share a request-scoped instance', async () => {
    class Rq extends Context.Tag('next-test/Rq20')<Rq, { id: number }>() {}
    let n = 0
    configureRuntime({ provide: [service(Rq, { lifetime: 'request' }, () => Effect.sync(() => ({ id: ++n })))] })
    const ids = await Promise.all(Array.from({ length: 20 }, () => runEffect(Effect.map(Rq, (r) => r.id))))
    expect(new Set(ids).size).toBe(20)
  })

  it.each(['request', 'app'] as const)('per-call provide shadows a %s-lifetime service for that call only', async (lifetime) => {
    class Svc extends Context.Tag(`next-test/Svc-${lifetime}`)<Svc, { label: string }>() {}
    configureRuntime({ provide: [service(Svc, { lifetime }, () => Effect.succeed({ label: 'global' }))] })
    const read = Effect.map(Svc, (s) => s.label)
    const local = service(Svc, { lifetime: 'request' }, () => Effect.succeed({ label: 'local' }))
    expect(await runEffect(read, { provide: [local] })).toBe('local')
    expect(await runEffect(read)).toBe('global')
  })

  it('a different config disposes the old app scope and uses the new services', async () => {
    class Svc extends Context.Tag('next-test/ReconfigSvc')<Svc, { label: string }>() {}
    const closeLog: string[] = []
    const makeConfig = (label: string) => ({
      provide: [
        service(Svc, {}, () =>
          Effect.acquireRelease(Effect.succeed({ label }), () => Effect.sync(() => void closeLog.push(`close:${label}`)))),
      ],
    })
    const read = Effect.map(Svc, (s) => s.label)
    configureRuntime(makeConfig('one'))
    expect(await runEffect(read)).toBe('one')
    configureRuntime(makeConfig('two'))
    expect(await runEffect(read)).toBe('two')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(closeLog).toContain('close:one')
  })

  it('a throwing onFinalizerError sink does not change a successful result', async () => {
    class Tracked extends Context.Tag('next-test/ThrowingSinkTracked')<Tracked, { n: number }>() {}
    configureRuntime({
      provide: [service(Tracked, { lifetime: 'request' }, () => Effect.acquireRelease(Effect.succeed({ n: 1 }), () => Effect.die('finalizer boom')))],
      onFinalizerError: () => {
        throw new Error('sink boom')
      },
    })
    await expect(runEffect(Effect.as(Tracked, 'ok'))).resolves.toBe('ok')
  })
})
