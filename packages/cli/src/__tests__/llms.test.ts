/** R4: the agent instructions (llms.md) ship with the CLI, stay small, and their error section is generated from ERROR_CODES. */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from '@sleekstack/analyze'

const pkgDir = fileURLToPath(new URL('../..', import.meta.url))
const file = `${pkgDir}/llms.md`
const START = '<!-- generated:errors:start -->'
const END = '<!-- generated:errors:end -->'

/** The generated section; run with `UPDATE_LLMS=1` to rewrite llms.md from the table. */
export const errorsSection = () =>
  Object.entries(ERROR_CODES)
    .map(([code, h]) => `- \`${code}\`: ${h.rule} Fix: ${h.fix.join('; ')}.`)
    .join('\n')

describe('llms.md', () => {
  it('error section matches the analyzer error table', () => {
    const md = fs.readFileSync(file, 'utf8')
    const [head, rest] = md.split(START)
    const tail = rest!.split(END)[1]
    const expected = `${head}${START}\n${errorsSection()}\n${END}${tail}`
    if (process.env.UPDATE_LLMS) fs.writeFileSync(file, expected)
    expect(md, 'stale: run UPDATE_LLMS=1 vitest run llms in packages/cli').toBe(expected)
  })

  it('is under 8KB and names no removed package', () => {
    expect(fs.statSync(file).size).toBeLessThan(8192)
    expect(fs.readFileSync(file, 'utf8')).not.toMatch(/@sleekstack\/(kit|react|next|islands)\b/)
  })

  it('ships in the package', () => {
    const out = JSON.parse(
      execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: pkgDir, encoding: 'utf8' }),
    )
    expect(out[0].files.map((f: { path: string }) => f.path)).toContain('llms.md')
  }, 60_000)
})
