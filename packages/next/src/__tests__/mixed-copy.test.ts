import { describe, expect, it } from 'vitest'
import { Effect, Layer } from 'effect'
import { globalValue } from 'effect/GlobalValue'
import { runEffect } from '../index'

describe('mixed module copies', () => {
  it('an old-shaped slot (config without a classifier) still rethrows Next redirects untouched', async () => {
    const seen: unknown[] = []
    // What an older copy of the runtime would have created under the frozen key.
    globalValue('@sleekstack/next/runtime-slot/v3', () => ({
      config: { layer: Layer.empty, onError: (c: unknown) => void seen.push(c) },
      disposing: undefined,
      runtime: undefined,
      fibers: new Set(),
      events: [],
      live: { app: false, scopes: new Set() },
      nextScopeId: 0,
    }))
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/x;307;' })
    await expect(runEffect(Effect.die(redirect))).rejects.toBe(redirect)
    await expect(runEffect(Effect.succeed(1))).resolves.toBe(1)
    expect(seen).toEqual([])
  })
})
