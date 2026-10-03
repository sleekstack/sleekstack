// Deliberate refresh of the regression baseline from the last `bench:json` run; commit the result like a snapshot.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { readResults } from './results'

const root = resolve(import.meta.dirname, '..')
const latest = readResults(resolve(root, 'results/latest.json'))
writeFileSync(resolve(root, 'baseline.json'), JSON.stringify(latest, null, 2) + '\n')
console.log(`baseline.json: ${latest.cases.length} cases`)
