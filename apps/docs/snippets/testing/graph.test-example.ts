import { describe, expect, it } from 'vitest'
import { layer, module, tag } from '@sleekstack/kit'
import { defineQuery } from '@sleekstack/kit/next'

interface Clock {
  now(): number
}
const Clock = tag<Clock>('Clock')
export const AppModule = module({ name: 'app', provide: [layer(Clock, { now: () => Date.now() })] })

// Assumes configureRuntime({ provide: [AppModule] }) ran in a setup file.
const readNow = defineQuery(function* () {
  return (yield* Clock).now()
})
// A provide passed to defineQuery shadows the runtime graph for this operation only.
const readFixedNow = defineQuery(
  function* () {
    return (yield* Clock).now()
  },
  { provide: [layer(Clock, { now: () => 0 })] },
)

describe('app graph', () => {
  it('swaps a service for one call', async () => {
    expect(await readFixedNow()).toBe(0)
    expect(await readNow()).toBeGreaterThan(0)
  })
})
