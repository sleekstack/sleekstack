import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyze, ERROR_CODES } from '../index'

describe('error table', () => {
  it('gives every code a rule, fixes and a docs anchor', () => {
    for (const h of Object.values(ERROR_CODES)) {
      expect(h.rule).not.toBe('')
      expect(h.fix.length).toBeGreaterThan(0)
      expect(h.docs).toMatch(/^\/docs\/errors#[a-z-]+$/)
    }
  })

  it('fills fix, docs and the column span on errors read from a node', () => {
    const e = analyze({ project: path.join(__dirname, 'fixtures', 'computed-lists', 'tsconfig.json') }).errors.find((x) => x.code === 'Computed')!
    expect(e.fix).toEqual(ERROR_CODES.Computed.fix)
    expect(e.docs).toBe(ERROR_CODES.Computed.docs)
    expect(e.column).toBeGreaterThan(0)
    expect(e.endLine).toBeGreaterThanOrEqual(e.line)
  })
})
