import { describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
import { configureRuntime, runEffect } from '../index'

const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/x;307;' })
const custom = { kind: 'my-redirect' }

describe('isControlFlow', () => {
  it('a supplied classifier decides control flow; Next digests are ordinary defects', async () => {
    const reported: unknown[] = []
    configureRuntime({ id: 'cf', layer: Layer.empty, onError: (c) => void reported.push(c), isControlFlow: (v) => v === custom })
    await expect(runEffect(Effect.die(custom))).rejects.toBe(custom)
    expect(reported).toHaveLength(0)
    const err = await runEffect(Effect.die(redirect)).catch((e: unknown) => e)
    expect(err).not.toBe(redirect)
    expect(reported).toHaveLength(1)
  })

  it('default classifies nothing as control flow', async () => {
    const reported: unknown[] = []
    configureRuntime({ id: 'none', layer: Layer.empty, onError: (c) => void reported.push(c) })
    const err = await runEffect(Effect.die(custom)).catch((e: unknown) => e)
    expect(err).not.toBe(custom)
    expect(reported).toHaveLength(1)
  })
})
