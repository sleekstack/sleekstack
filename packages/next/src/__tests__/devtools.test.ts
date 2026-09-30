import { describe, expect, it, vi } from 'vitest'
import { Effect, Layer } from 'effect'
import { configureRuntime, runEffect } from '../index'
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

    for (let i = 0; i < 150; i++) await runEffect(Effect.void)
    snap = devtoolsSnapshot()
    expect(snap.scopes.length + snap.errors.length).toBe(200)

    configureRuntime({ layer: Layer.empty })
    snap = devtoolsSnapshot()
    expect(snap.scopes.length + snap.errors.length).toBe(0)
  })

  it('handler returns JSON with graph in dev; 404 and no recording in production', async () => {
    configureRuntime({ layer: Layer.empty })
    const body = await devtoolsHandler({ graph: () => ({ nodes: [] }) })().json()
    expect(body).toEqual({ scopes: [], errors: [], graph: { nodes: [] } })

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
})
