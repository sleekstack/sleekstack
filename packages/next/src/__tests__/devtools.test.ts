import { describe, expect, it, vi } from 'vitest'
import { Effect, Layer } from 'effect'
import { configureRuntime, getRuntime, runEffect } from '../index'
import { devtoolsHandler, devtoolsSnapshot } from '../devtools'

describe('devtools', () => {
  it('records scopes and errors, bounded at 200, cleared on reconfigure', async () => {
    configureRuntime({ layer: Layer.empty, onError: () => {} })
    await runEffect(Effect.succeed(1))
    await expect(runEffect(Effect.die('boom'))).rejects.toBeDefined()
    let snap = devtoolsSnapshot()
    expect(snap.scopes.map((e) => e.kind)).toEqual(['acquire', 'scope-open', 'scope-close', 'scope-open', 'scope-close'])
    expect(snap.errors).toHaveLength(1)
    expect(snap.graph).toBeUndefined()

    expect(snap.live).toEqual({ app: true, scopes: [] })
    for (let i = 0; i < 150; i++) await runEffect(Effect.void)
    snap = devtoolsSnapshot()
    expect(snap.scopes.length + snap.errors.length).toBe(200)
    expect(snap.live.app).toBe(true) // acquire was evicted from history, live state is not

    configureRuntime({ layer: Layer.empty })
    snap = devtoolsSnapshot()
    expect(snap.scopes.length + snap.errors.length).toBe(0)
  })

  it('handler returns JSON with graph in dev; 404 and no recording in production', async () => {
    configureRuntime({ layer: Layer.empty })
    const body = await devtoolsHandler({ graph: () => ({ nodes: [] }) })().json()
    expect(body).toEqual({ scopes: [], errors: [], live: { app: false, scopes: [] }, graph: { nodes: [] } })

    vi.stubEnv('NODE_ENV', 'production')
    try {
      expect(devtoolsHandler()().status).toBe(404)
      await runEffect(Effect.void)
      expect(devtoolsSnapshot().scopes).toEqual([])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('late events from a replaced runtime never repopulate the cleared buffer; acquire follows a successful build', async () => {
    // build failure: no acquire
    configureRuntime({ layer: Layer.fail('nope') as unknown as Layer.Layer<never> })
    await expect(runEffect(Effect.void)).rejects.toBeDefined()
    expect(devtoolsSnapshot().scopes.map((e) => e.kind)).not.toContain('acquire')

    // reconfigure while a call is in flight (with a failing finalizer): old events must not land in the new buffer
    let resolveStarted!: () => void
    const started = new Promise<void>((r) => (resolveStarted = r))
    configureRuntime({ layer: Layer.empty, onError: () => {} })
    const inflight = runEffect(Effect.zipRight(Effect.sync(() => resolveStarted()), Effect.never), {
      request: Layer.scopedDiscard(Effect.addFinalizer(() => Effect.die('finalizer'))) as unknown as Layer.Layer<any, any, any>,
    })
    inflight.catch(() => {})
    await started
    configureRuntime({ layer: Layer.empty })
    await inflight.catch(() => {})
    await new Promise((r) => setTimeout(r, 20))
    const snap = devtoolsSnapshot()
    expect(snap.scopes).toEqual([])
    expect(snap.errors).toEqual([])
  })

  it('an open scope stays in live state after history eviction; getRuntime() builds are recorded', async () => {
    configureRuntime({ layer: Layer.empty })
    await getRuntime().runtimeEffect.pipe(Effect.runPromise)
    expect(devtoolsSnapshot().live.app).toBe(true)
    let resolveStarted!: () => void
    const started = new Promise<void>((r) => (resolveStarted = r))
    const long = runEffect(Effect.zipRight(Effect.sync(() => resolveStarted()), Effect.never))
    long.catch(() => {})
    await started
    for (let i = 0; i < 250; i++) await runEffect(Effect.void)
    const snap = devtoolsSnapshot()
    expect(snap.scopes.some((e) => e.kind === 'scope-open' && e.label === snap.live.scopes[0])).toBe(false)
    expect(snap.live.scopes).toHaveLength(1)
    configureRuntime({ layer: Layer.empty })
    await long.catch(() => {})
  })

  it('serves loopback requests only unless allowRemote', async () => {
    configureRuntime({ layer: Layer.empty })
    const local = new Request('http://localhost:3000/api/devtools')
    const lan = new Request('http://192.168.1.5:3000/api/devtools')
    expect(devtoolsHandler()(local).status).toBe(200)
    expect(devtoolsHandler()(lan).status).toBe(403)
    expect(devtoolsHandler({ allowRemote: true })(lan).status).toBe(200)
  })
})
