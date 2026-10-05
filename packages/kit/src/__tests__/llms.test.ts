/** R4: llms.md ships with the package and stays small (its error section is checked in packages/analyze). */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const pkgDir = fileURLToPath(new URL('../..', import.meta.url))

describe('llms.md', () => {
  it('is under 8KB', () => {
    expect(fs.statSync(`${pkgDir}/llms.md`).size).toBeLessThan(8192)
  })

  it('pack lists llms.md and the sources/types', () => {
    const out = JSON.parse(
      execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: pkgDir, encoding: 'utf8' }),
    )
    const files: string[] = out[0].files.map((f: { path: string }) => f.path)
    expect(files).toContain('llms.md')
    expect(files).toContain('src/index.ts')
    expect(files.some((f) => f.startsWith('src/__tests__'))).toBe(false)
  }, 60_000)
})
