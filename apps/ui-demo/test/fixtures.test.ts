import * as fs from 'node:fs'
import * as path from 'node:path'
import { analyzeComponents } from '@sleekstack/analyze'
import { describe, expect, it } from 'vitest'

const root = path.join(__dirname, '..')
const fixture = (name: string) => path.join(root, 'fixtures', name)
/** The `// @error Code` markers of a fixture, as `{ code, file, line }`. */
const expected = (name: string) =>
  fs
    .readdirSync(fixture(name))
    .filter((f) => /\.tsx?$/.test(f))
    .flatMap((file) =>
      fs
        .readFileSync(path.join(fixture(name), file), 'utf8')
        .split('\n')
        .flatMap((l, i) => {
          const m = /\/\/ @error (\w+)/.exec(l)
          return m ? [{ code: m[1]!, file, line: i + 1 }] : []
        }),
    )

// Each case builds a full TypeScript program; that exceeds vitest's 5s default on a CI runner.
describe('one fixture per Analyzer code', { timeout: 60_000 }, () => {
  it.each([
    ['missing-dependency', 'MissingDependency'],
    ['unhandled-error', 'UnhandledError'],
    ['effect-inside-react', 'EffectInsideReact'],
    ['jsx-missing-dependency', 'MissingDependency'],
    ['unresolved', 'Unresolved'],
    ['conditional-slot', 'ConditionalSlot'],
    ['missing-key', 'MissingKey'],
    ['event-closure', 'UnhandledError'],
  ])('%s reports %s', (name, code) => {
    const { errors } = analyzeComponents({ project: path.join(fixture(name), 'tsconfig.json') })
    expect(errors.map(({ code, file, line }) => ({ code, file: path.basename(file), line }))).toEqual(expected(name))
    expect(expected(name).map((e) => e.code)).toEqual([code])
  })

  it('the demo app itself is clean', () => {
    const r = analyzeComponents({ project: path.join(root, 'tsconfig.json') })
    expect(r.errors).toEqual([])
    expect(r.trees).toHaveLength(2) // the mount in main.tsx and the resume in src/resume/entry.ts
  })
})
