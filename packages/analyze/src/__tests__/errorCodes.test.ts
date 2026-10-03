import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyze, analyzeComponents, ERROR_CODES } from '../index'

const project = (name: string) => path.join(__dirname, 'fixtures', name, 'tsconfig.json')

describe('error table', () => {
  it('gives every code a rule, fixes and a docs anchor', () => {
    for (const h of Object.values(ERROR_CODES)) {
      expect(h.rule).not.toBe('')
      expect(h.fix.length).toBeGreaterThan(0)
      expect(h.docs).toMatch(/^\/docs\/errors#[a-z-]+$/)
    }
  })

  it.each([
    ['extraction', () => analyze({ project: project('computed-lists') }).errors, 'Computed'],
    ['graph validation', () => analyze({ project: project('missing-dependency') }).errors, 'MissingDependency'],
    ['component pass', () => analyzeComponents({ project: project('ui-missing') }).errors, 'MissingDependency'],
  ] as const)('fills fix, docs and the column span on %s errors', (_, errors, code) => {
    const e = errors().find((x) => x.code === code)!
    expect(e.fix).toEqual(ERROR_CODES[code].fix)
    expect(e.docs).toBe(ERROR_CODES[code].docs)
    expect(e.column).toBeGreaterThan(0)
    expect(e.endLine).toBeGreaterThanOrEqual(e.line)
  })
})
