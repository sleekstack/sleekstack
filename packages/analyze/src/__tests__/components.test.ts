import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeComponents } from '../index'

const dir = (name: string) => path.join(__dirname, 'fixtures', name)
const run = (name: string) => analyzeComponents({ project: path.join(dir(name), 'tsconfig.json') })
const located = (name: string) => run(name).errors.map(({ code, file, line }) => ({ code, file, line }))
/** Every `// @error Code` marker in a fixture's .ts / .tsx files. */
const expected = (name: string) =>
  fs.readdirSync(dir(name)).filter((f) => /\.tsx?$/.test(f)).sort().flatMap((file) =>
    fs.readFileSync(path.join(dir(name), file), 'utf8').split('\n').flatMap((l, i) => {
      const m = /\/\/ @error (\w+)/.exec(l)
      return m ? [{ code: m[1]!, file, line: i + 1 }] : []
    }))
const sorted = <T extends { file: string; line: number }>(xs: T[]) => xs.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)

describe('component pass', () => {
  it.each(['ui-missing', 'ui-unhandled', 'ui-react', 'ui-unresolved'])('%s: code and file:line', (name) => {
    const want = expected(name)
    expect(want.length).toBeGreaterThan(0)
    expect(sorted(located(name))).toEqual(want)
  })

  it('clean fixture: one tree per mount, nothing reported', () => {
    const r = run('ui-clean')
    expect(r.errors).toEqual([])
    expect(r.trees.map((t) => [t.line, t.provides, t.root.kind])).toEqual([[29, ['UserRepo'], 'component']])
  })

  it('non-ui projects have no trees', () => {
    expect(run('kit-app')).toEqual({ trees: [], errors: [] })
  })
})
