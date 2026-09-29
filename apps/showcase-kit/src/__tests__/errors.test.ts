/**
 * apps/showcase-kit/src/__tests__/errors.test.ts
 *
 * Build-time cases: the analyzer reports each one's code in src/errors/graphs.ts (the report the page renders).
 * Runtime cases: each throws a SleekStackError with its expected code; UNEXPECTED fails.
 */
import path from 'node:path'
import { main } from 'sleekstack/src/check'
import { describe, expect, it } from 'vitest'
import { buildTimeResults, errorCases, runCase } from '../errors/cases.server'

describe('kit error gallery', () => {
  it('build-time cases come from the analyzer report with file:line', () => {
    let out = ''
    expect(main(['check', '--json', '--entry', 'src/server/runtime.server.ts'], { cwd: path.join(__dirname, '../..'), out: (s) => (out += s), err: () => {} })).toBe(0)
    const results = buildTimeResults(JSON.parse(out).graphErrors)
    for (const r of results) expect(r.code, r.id).not.toBe('UNEXPECTED')
    expect(results.every((r) => /^src\/errors\/graphs\.ts:\d+$/.test(r.at))).toBe(true)
    expect(buildTimeResults([])[0]!.code).toBe('UNEXPECTED')
  })

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
