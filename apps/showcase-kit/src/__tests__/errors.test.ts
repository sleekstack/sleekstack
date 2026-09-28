/**
 * apps/showcase-kit/src/__tests__/errors.test.ts
 *
 * Every gallery case throws a SleekStackError with its expected code; UNEXPECTED fails.
 */
import { describe, expect, it } from 'vitest'
import { errorCases, runCase } from '../errors/cases.server'

describe('kit error gallery', () => {
  it.each(errorCases.map((c) => [c.id, c] as const))('%s', async (_, c) => {
    const result = await runCase(c)
    expect(result.code).toBe(c.expectedCode)
    expect(result.message.length).toBeGreaterThan(0)
  })

  it('misbehaving cases are UNEXPECTED', async () => {
    expect((await runCase({ id: 'x', expectedCode: 'Other', run: errorCases[0]!.run })).code).toBe('UNEXPECTED')
    expect((await runCase({ id: 'x', expectedCode: 'Other', run: () => 1 })).code).toBe('UNEXPECTED')
    expect((await runCase({ id: 'x', expectedCode: 'Other', run: () => { throw new Error('plain') } })).code).toBe('UNEXPECTED')
  })
})
