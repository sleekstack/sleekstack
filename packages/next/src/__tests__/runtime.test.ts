import { describe, expect, it } from 'vitest'
import { Cause, Context, Effect, Layer } from 'effect'
import { configureRuntime, getRuntime, runEffect, RuntimeNotConfigured } from '../index'

// Shares the process-global runtime slot: the unconfigured case runs first.

class Greeting extends Context.Tag('rt-test/Greeting')<Greeting, string>() {}
class Req extends Context.Tag('rt-test/Req')<Req, string>() {}

const collect = () => {
  const causes: Cause.Cause<unknown>[] = []
  return { causes, onError: (c: Cause.Cause<unknown>) => void causes.push(c) }
}

describe('runEffect', () => {
  it('rejects with RuntimeNotConfigured before configureRuntime', async () => {
    await expect(runEffect(Effect.succeed(1))).rejects.toBeInstanceOf(RuntimeNotConfigured)
    expect(() => getRuntime()).toThrow(RuntimeNotConfigured)
  })

  it('reports a defect once and a finalizer failure once; finalizer failure keeps the result', async () => {
    const sink = collect()
    configureRuntime({ layer: Layer.succeed(Greeting, 'hi'), onError: sink.onError })
    await expect(runEffect(Effect.die(new Error('boom')))).rejects.toThrow(/boom/)
    expect(sink.causes).toHaveLength(1)

    const failingRelease = Layer.scoped(Req, Effect.acquireRelease(Effect.succeed('r'), () => Effect.die('release')))
    await expect(runEffect(Req, { request: failingRelease })).resolves.toBe('r')
    expect(sink.causes).toHaveLength(2)
    expect(Cause.pretty(sink.causes[1]!)).toMatch(/release/)

    // Typed failures are not reported.
    await expect(runEffect(Effect.fail('typed'))).rejects.toThrow()
    expect(sink.causes).toHaveLength(2)
  })

  it('a throwing onError never changes the outcome', async () => {
    configureRuntime({ layer: Layer.empty, onError: () => { throw new Error('sink') } })
    await expect(runEffect(Effect.die(new Error('orig')))).rejects.toThrow(/orig/)
  })

  it('redirect/notFound and interruption pass through unreported', async () => {
    const sink = collect()
    configureRuntime({ layer: Layer.empty, onError: sink.onError })
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/x;307;' })
    const notFound = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' })
    await expect(runEffect(Effect.sync(() => { throw redirect }))).rejects.toBe(redirect)
    await expect(runEffect(Effect.sync(() => { throw notFound }))).rejects.toBe(notFound)
    await expect(runEffect(Effect.interrupt)).rejects.toThrow()
    expect(sink.causes).toHaveLength(0)
  })

  it('retries a failed layer build on the next call', async () => {
    let attempts = 0
    configureRuntime({
      layer: Layer.effect(Greeting, Effect.suspend(() => (++attempts === 1 ? Effect.fail('down') : Effect.succeed('up')))),
    })
    await expect(runEffect(Greeting)).rejects.toThrow()
    await expect(runEffect(Greeting)).resolves.toBe('up')
    expect(attempts).toBe(2)
  })

  it('overrides shadow a request service built in the same call, and what request builds from', async () => {
    configureRuntime({ layer: Layer.succeed(Greeting, 'app') })
    const request = Layer.merge(Layer.succeed(Req, 'req'), Layer.effect(Req, Effect.succeed('unused')))
    const derived = Layer.effect(Req, Effect.map(Greeting, (g) => `req:${g}`))
    const overrides = Layer.merge(Layer.succeed(Req, 'override'), Layer.succeed(Greeting, 'over'))
    await expect(runEffect(Req, { request, overrides })).resolves.toBe('override')
    await expect(runEffect(Req, { request: derived, overrides: Layer.succeed(Greeting, 'over') })).resolves.toBe('req:over')
    await expect(runEffect(Greeting)).resolves.toBe('app')
  })

  it('reconfigure interrupts in-flight calls before disposing the old runtime', async () => {
    const log: string[] = []
    configureRuntime({
      layer: Layer.scopedDiscard(Effect.addFinalizer(() => Effect.sync(() => void log.push('dispose')))),
    })
    const inFlight = runEffect(Effect.never.pipe(Effect.onInterrupt(() => Effect.sync(() => void log.push('interrupted')))))
    await new Promise((r) => setTimeout(r, 10))
    configureRuntime({ layer: Layer.empty })
    await expect(inFlight).rejects.toThrow()
    await new Promise((r) => setTimeout(r, 10))
    expect(log).toEqual(['interrupted', 'dispose'])
  })

  it('reports an app-layer build defect once, then retries', async () => {
    const sink = collect()
    configureRuntime({ layer: Layer.effect(Greeting, Effect.die(new Error('acquire boom'))), onError: sink.onError })
    await expect(runEffect(Effect.succeed(1))).rejects.toThrow()
    expect(sink.causes).toHaveLength(1)
    expect(Cause.pretty(sink.causes[0]!)).toMatch(/acquire boom/)
  })

  it('routes an app-layer finalizer failure during reconfigure to the old config sink, not an unhandled rejection', async () => {
    const sink = collect()
    configureRuntime({
      layer: Layer.scopedDiscard(Effect.addFinalizer(() => Effect.die('root release'))),
      onError: sink.onError,
    })
    await runEffect(Effect.succeed(1))
    configureRuntime({ layer: Layer.empty })
    await new Promise((r) => setTimeout(r, 20))
    expect(sink.causes).toHaveLength(1)
    expect(Cause.pretty(sink.causes[0]!)).toMatch(/root release/)
  })

  it('one onError sink gets every report with its phase: call defect, finalizer failure, failed build', async () => {
    const seen: string[] = []
    configureRuntime({ layer: Layer.empty, onError: (_c, info) => void seen.push(info.phase) })
    const failingRelease = Layer.scoped(Req, Effect.acquireRelease(Effect.succeed('r'), () => Effect.die('fin')))
    await expect(runEffect(Req, { request: failingRelease })).resolves.toBe('r')
    await expect(runEffect(Effect.die(new Error('d')))).rejects.toThrow()
    configureRuntime({ layer: Layer.fail('startup') as never, onError: (_c, info) => void seen.push(info.phase) })
    await expect(runEffect(Effect.void)).rejects.toBeDefined()
    expect(seen).toEqual(['finalizer', 'call', 'build'])
  })

  it('a new runtime is not built until the previous one has finished disposing', async () => {
    const log: string[] = []
    const slow = (name: string) =>
      Layer.scopedDiscard(Effect.acquireRelease(Effect.sync(() => void log.push(`up:${name}`)), () => Effect.promise(() => new Promise<void>((r) => setTimeout(() => (log.push(`down:${name}`), r()), 30)))))
    configureRuntime({ layer: slow('a') })
    await runEffect(Effect.void)
    configureRuntime({ layer: slow('b') })
    await runEffect(Effect.void)
    expect(log).toEqual(['up:a', 'down:a', 'up:b'])
  })

  it('a call started right before a synchronous reconfigure is still interrupted', async () => {
    configureRuntime({ layer: Layer.empty })
    const inFlight = runEffect(Effect.never)
    configureRuntime({ layer: Layer.empty })
    await expect(inFlight).rejects.toThrow()
  })

  it('a config with the same id (another module copy) is a no-op; replace forces a new runtime', async () => {
    const a = { id: 'app', layer: Layer.empty }
    configureRuntime(a)
    const runtime = getRuntime()
    configureRuntime({ id: 'app', layer: Layer.empty })
    expect(getRuntime()).toBe(runtime)
    configureRuntime({ id: 'app', layer: Layer.empty }, { replace: true })
    expect(getRuntime()).not.toBe(runtime)
    configureRuntime({ id: 'other', layer: Layer.empty })
    expect(getRuntime()).not.toBe(runtime)
  })

  it('Next control flow in the failure channel passes through unreported', async () => {
    const seen: unknown[] = []
    configureRuntime({ layer: Layer.empty, onError: (c) => seen.push(c) })
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/x;307;' })
    await expect(runEffect(Effect.fail(redirect))).rejects.toBe(redirect)
    expect(seen).toEqual([])
  })
})
