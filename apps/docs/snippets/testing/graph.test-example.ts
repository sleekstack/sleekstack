import { describe, expect, it } from 'vitest'
import { layer, module, snapshot, tag } from '@sleekstack/kit'
import { defineQuery } from '@sleekstack/kit/next'

interface Clock { now(): number }
const Clock = tag<Clock>('Clock')
const AppModule = module({ name: 'app', provide: [layer(Clock, { now: () => Date.now() })] })

// Assumes configureRuntime({ provide: [AppModule] }) ran in a setup file.
const readNow = defineQuery(function* () { return (yield* Clock).now() }, [Clock])
// A provide passed to defineQuery shadows the runtime graph for this operation only.
const readFixedNow = defineQuery(function* () { return (yield* Clock).now() }, [Clock], { provide: [layer(Clock, { now: () => 0 })] })

describe('app graph', () => {
  it('validates without constructing services', () => {
    expect(snapshot(AppModule).nodes.map((n) => n.id)).toContain('Clock')
  })

  it('swaps a service for one call', async () => {
    expect(await readFixedNow()).toBe(0)
    expect(await readNow()).toBeGreaterThan(0)
  })
})
