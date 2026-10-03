import { execFileSync } from 'node:child_process'
import { readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publishedFile, renderBenchmarks } from '../scripts/generate-benchmarks.mjs'

const script = join(import.meta.dirname, '../scripts/generate-benchmarks.mjs')

describe('benchmarks page', () => {
  it('renders a table per suite with machine info, versions and caveats', () => {
    const page: string = renderBenchmarks(JSON.parse(readFileSync(publishedFile, 'utf8')))
    for (const h of ['## Atoms', '## String render', '## DOM render', '## JSX instance wrapper']) expect(page).toContain(h)
    expect(page).toContain('one machine running one workload')
    expect(page).toMatch(/jotai \d/)
    expect(page).toContain('node swaps')
  })

  it('fails naming the command when published.json is missing', () => {
    const aside = `${publishedFile}.aside`
    renameSync(publishedFile, aside)
    try {
      expect(() => execFileSync('node', [script], { stdio: 'pipe' })).toThrow(/pnpm --filter bench publish-results/)
    } finally {
      renameSync(aside, publishedFile)
    }
  })
})
