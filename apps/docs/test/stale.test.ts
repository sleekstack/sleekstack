import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const STALE = ['descriptive graph metadata', 'pnpm 10', 'pnpm@10']
const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()

/** Returns `path: phrase` for every stale phrase found (ADR history and .flow excluded). */
function findStale(files: Array<[path: string, text: string]>): string[] {
  return files
    .filter(([path]) => !path.startsWith('docs/adr/') && !path.startsWith('.flow/'))
    .flatMap(([path, text]) => STALE.filter((p) => text.toLowerCase().includes(p)).map((p) => `${path}: ${p}`))
}

describe('stale phrases', () => {
  it('no tracked *.md claims descriptive-only privacy or pnpm 10', () => {
    const paths = execFileSync('git', ['ls-files', '*.md'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
    expect(findStale(paths.map((p) => [p, readFileSync(join(root, p), 'utf8')]))).toEqual([])
  })

  it('flags a reintroduced phrase outside the exclusions', () => {
    expect(
      findStale([
        ['README.md', 'Exports are Descriptive graph metadata. Use pnpm@10.'],
        ['docs/adr/0002-x.md', 'descriptive graph metadata'],
        ['.flow/specs/a.md', 'pnpm 10'],
      ]),
    ).toEqual(['README.md: descriptive graph metadata', 'README.md: pnpm@10'])
  })
})
