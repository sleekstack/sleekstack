/** R4: the error section of @sleekstack/kit's llms.md is generated from ERROR_CODES. */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from '../errorCodes'

const pkgDir = fileURLToPath(new URL('../../../kit', import.meta.url))
const file = `${pkgDir}/llms.md`
const START = '<!-- generated:errors:start -->'
const END = '<!-- generated:errors:end -->'

/** The generated section; run with `UPDATE_LLMS=1` to rewrite llms.md from the table. */
export const errorsSection = () =>
  Object.entries(ERROR_CODES)
    .map(([code, h]) => `- \`${code}\`: ${h.rule} Fix: ${h.fix.join('; ')}.`)
    .join('\n')

describe('kit llms.md', () => {
  it('error section matches the analyzer error table', () => {
    const md = fs.readFileSync(file, 'utf8')
    const [head, rest] = md.split(START)
    const tail = rest!.split(END)[1]
    const expected = `${head}${START}\n${errorsSection()}\n${END}${tail}`
    if (process.env.UPDATE_LLMS) fs.writeFileSync(file, expected)
    expect(md, 'stale: run UPDATE_LLMS=1 vitest run llms in packages/analyze').toBe(expected)
  })
})
