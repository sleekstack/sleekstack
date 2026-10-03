// Ratio gate: each SleekStack case is divided by a reference measured in the same run, and that ratio is compared with
// the baseline's. Absolute times are never gated: CI runners vary far more than the regressions worth catching.
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { type CaseResult, InputError, readResults, type Results } from './results'

/** Reference library per suite (the part of the case name before `/`). */
export const REFERENCE: Record<string, string> = { atoms: 'jotai', 'render-string': 'react', 'render-dom': 'react', 'jsx-overhead': 'direct' }
/** Allowed ratio growth over the baseline, as a fraction. */
export const DEFAULT_TOLERANCE = 0.5
/** Per-case overrides of {@link DEFAULT_TOLERANCE}. */
export const TOLERANCE: Record<string, number> = {}
/** Relative margin of error (percent) above which a case is `NOISY` and left out of the gate. */
export const NOISY_RME = 20

export type Status = 'OK' | 'IMPROVED' | 'REGRESSED' | 'NEW' | 'MISSING' | 'NOISY'
export interface Row {
  case: string
  status: Status
  baseline?: number
  ratio?: number
}
export interface Report {
  rows: Array<Row>
  warnings: Array<string>
  failed: boolean
  markdown: string
}

const ratios = (r: Results) => {
  const by = new Map(r.cases.map((c) => [`${c.case}\0${c.library}`, c]))
  const out = new Map<string, { ratio: number; noisy: boolean }>()
  for (const c of r.cases) {
    if (c.library !== 'sleekstack') continue
    const ref: CaseResult | undefined = by.get(`${c.case}\0${REFERENCE[c.case.split('/')[0]!]}`)
    if (ref) out.set(c.case, { ratio: c.mean / ref.mean, noisy: c.rme > NOISY_RME || ref.rme > NOISY_RME })
  }
  return out
}

const fmt = (n: number | undefined) => (n === undefined ? '' : n.toFixed(3))

export const compare = (latest: Results, baseline: Results): Report => {
  const now = ratios(latest)
  const base = ratios(baseline)
  const rows: Array<Row> = []
  for (const [name, { ratio, noisy }] of now) {
    const b = base.get(name)?.ratio
    const tol = TOLERANCE[name] ?? DEFAULT_TOLERANCE
    const status: Status = b === undefined ? 'NEW' : noisy ? 'NOISY' : ratio > b * (1 + tol) ? 'REGRESSED' : ratio < b / (1 + tol) ? 'IMPROVED' : 'OK'
    rows.push({ case: name, status, baseline: b, ratio })
  }
  for (const [name, { ratio }] of base) if (!now.has(name)) rows.push({ case: name, status: 'MISSING', baseline: ratio })
  const warnings: Array<string> = []
  const major = (v: string) => v.replace(/^v/, '').split('.')[0]
  if (major(latest.machine.node) !== major(baseline.machine.node))
    warnings.push(`baseline was recorded on Node ${baseline.machine.node}, this run is Node ${latest.machine.node}`)
  const failed = rows.some((r) => r.status === 'REGRESSED' || r.status === 'MISSING')
  const markdown = [
    '| case | baseline ratio | ratio | status |',
    '| --- | ---: | ---: | --- |',
    ...rows.map((r) => `| ${r.case} | ${fmt(r.baseline)} | ${fmt(r.ratio)} | ${r.status} |`),
    '',
    'Ratio = SleekStack mean / same-run reference mean (jotai for atoms, React for render, `direct` for jsx-overhead).',
    ...warnings.map((w) => `\n> Warning: ${w}`),
  ].join('\n')
  return { rows, warnings, failed, markdown }
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  const root = resolve(import.meta.dirname, '..')
  try {
    const report = compare(readResults(resolve(root, 'results/latest.json')), readResults(resolve(root, 'baseline.json')))
    console.log(report.markdown)
    for (const w of report.warnings) console.error(`::warning::${w}`)
    process.exit(report.failed ? 1 : 0)
  } catch (e) {
    if (!(e instanceof InputError)) throw e
    console.error(e.message)
    process.exit(2)
  }
}
