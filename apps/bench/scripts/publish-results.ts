// The only writer of `results/published.json`, the snapshot the docs benchmarks page renders. Run deliberately, never in CI.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readResults } from './results'

const root = resolve(import.meta.dirname, '..')
const latest = readResults(resolve(root, 'results/latest.json'))
writeFileSync(
  resolve(root, 'results/published.json'),
  JSON.stringify({ ...latest, publishedAt: new Date().toISOString().slice(0, 10) }, null, 2) + '\n',
)
console.log(`results/published.json: ${latest.cases.length} cases`)
