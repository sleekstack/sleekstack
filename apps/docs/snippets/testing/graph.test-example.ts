import { Context, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { declareLayer, makeAppScope, module } from '@sleekstack/core'

class Clock extends Context.Tag('Clock')<Clock, { now(): number }>() {}
export const AppModule = module({
  name: 'app',
  entries: [declareLayer(Layer.succeed(Clock, { now: () => Date.now() }))],
})

const nowIn = (extra: Parameters<typeof makeAppScope>[0] = []) =>
  Effect.runPromise(makeAppScope([AppModule, ...extra])).then((app) => Context.get(app.context, Clock).now())

describe('app graph', () => {
  it('swaps a service with a later, more local entry', async () => {
    // Entries build in order and the later Clock shadows the module's.
    expect(await nowIn([declareLayer(Layer.succeed(Clock, { now: () => 0 }))])).toBe(0)
    expect(await nowIn()).toBeGreaterThan(0)
  })
})
