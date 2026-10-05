// Turns vitest's `results/raw.json` into `results/latest.json`: flat per-case rows plus library versions and machine info.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { cpus, platform, release } from 'node:os'
import { resolve } from 'node:path'
import type { CaseResult, Results } from './results'

const root = resolve(import.meta.dirname, '..')
const raw = resolve(root, 'results/raw.json')
if (!existsSync(raw)) {
  console.error('results/raw.json missing: the vitest bench run produced no results')
  process.exit(2)
}
const swapsFile = resolve(root, 'results/swaps.json')
const swaps: Record<string, Record<string, number>> = existsSync(swapsFile)
  ? JSON.parse(readFileSync(swapsFile, 'utf8'))
  : {}

const cases: Array<CaseResult> = []
for (const file of JSON.parse(readFileSync(raw, 'utf8')).files ?? [])
  for (const group of file.groups ?? []) {
    const name = String(group.fullName).split(' > ').slice(1).join(' > ')
    for (const b of group.benchmarks ?? [])
      cases.push({
        case: name,
        library: b.name,
        hz: b.hz,
        mean: b.mean,
        p99: b.p99,
        rme: b.rme,
        samples: b.sampleCount,
        ...(swaps[name]?.[b.name] !== undefined && { swaps: swaps[name][b.name] }),
      })
  }
if (cases.length === 0) {
  console.error('vitest bench produced no cases')
  process.exit(2)
}

const version = (pkg: string) =>
  JSON.parse(readFileSync(resolve(root, 'node_modules', pkg, 'package.json'), 'utf8')).version as string
const results: Results = {
  machine: { node: process.version, cpu: cpus()[0]?.model ?? 'unknown', os: `${platform()} ${release()}` },
  versions: Object.fromEntries(
    [
      '@sleekstack/core',
      '@sleekstack/ui',
      'jotai',
      '@effect-atom/atom',
      'effect',
      'react',
      'react-dom',
      'jsdom',
      'vitest',
    ].map((p) => [p, version(p)]),
  ),
  cases,
}
writeFileSync(resolve(root, 'results/latest.json'), JSON.stringify(results, null, 2) + '\n')
console.log(`results/latest.json: ${cases.length} cases`)
