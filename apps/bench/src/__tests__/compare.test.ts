import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { compare } from '../../scripts/compare'
import { InputError, parseResults, readResults, type Results } from '../../scripts/results'

const fixture = (name: string) => resolve(import.meta.dirname, 'fixtures', name)
const baseline = readResults(fixture('baseline.json'))
// A copy of the baseline with one case's sleekstack mean (or other fields) changed.
const latest = (edit: (r: Results) => void): Results => {
  const r: Results = structuredClone(baseline)
  edit(r)
  return r
}
const sleek = (r: Results, name: string) => r.cases.find((c) => c.case === name && c.library === 'sleekstack')!
const status = (r: Results, name: string) => compare(r, baseline).rows.find((row) => row.case === name)?.status

describe('compare', () => {
  it('passes an unchanged run', () => {
    const report = compare(baseline, baseline)
    expect(report.failed).toBe(false)
    expect(report.rows.map((r) => r.status)).toEqual(['OK', 'OK'])
  })

  it('flags a ratio above the 50% tolerance as REGRESSED and fails', () => {
    const r = latest((r) => void (sleek(r, 'atoms/write').mean = 1.6))
    expect(status(r, 'atoms/write')).toBe('REGRESSED')
    expect(compare(r, baseline).failed).toBe(true)
    expect(compare(r, baseline).markdown).toContain('| atoms/write | 0.500 | 0.800 | REGRESSED |')
  })

  it('stays within tolerance when the reference slows down equally', () => {
    const r = latest((r) => r.cases.forEach((c) => (c.mean *= 3)))
    expect(compare(r, baseline).failed).toBe(false)
  })

  it('reports an improvement without failing', () => {
    const r = latest((r) => void (sleek(r, 'atoms/write').mean = 0.2))
    expect(status(r, 'atoms/write')).toBe('IMPROVED')
    expect(compare(r, baseline).failed).toBe(false)
  })

  it('reports a case missing from the baseline as NEW without failing', () => {
    const r = latest((r) =>
      r.cases.push({ ...sleek(r, 'atoms/write'), case: 'atoms/new' }, { ...r.cases[1]!, case: 'atoms/new' }),
    )
    expect(status(r, 'atoms/new')).toBe('NEW')
    expect(compare(r, baseline).failed).toBe(false)
  })

  it('reports a baseline case with no result as MISSING and fails', () => {
    const r = latest((r) => void (r.cases = r.cases.filter((c) => c.case !== 'atoms/write')))
    expect(status(r, 'atoms/write')).toBe('MISSING')
    expect(compare(r, baseline).failed).toBe(true)
  })

  it('excludes a NOISY case from the gate', () => {
    const r = latest((r) => Object.assign(sleek(r, 'atoms/write'), { mean: 5, rme: 25 }))
    expect(status(r, 'atoms/write')).toBe('NOISY')
    expect(compare(r, baseline).failed).toBe(false)
  })

  it('warns, without failing, on a different Node major', () => {
    const report = compare(
      latest((r) => void (r.machine.node = 'v24.1.0')),
      baseline,
    )
    expect(report.failed).toBe(false)
    expect(report.warnings[0]).toContain('v22.20.0')
  })

  it('rejects malformed JSON and a schema mismatch naming the file', () => {
    expect(() => readResults(fixture('malformed.json'))).toThrow(InputError)
    expect(() => readResults(fixture('malformed.json'))).toThrow(/malformed\.json: malformed JSON/)
    expect(() => parseResults(readFileSync(fixture('wrong-schema.json'), 'utf8'), 'x.json')).toThrow(
      'x.json: does not match the results schema',
    )
    expect(() => readResults(fixture('absent.json'))).toThrow(/absent\.json: missing/)
  })
})
