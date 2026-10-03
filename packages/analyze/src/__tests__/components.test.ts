import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeComponents, type UiNode } from '../index'

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
  it.each(['ui-missing', 'ui-unhandled', 'ui-react', 'ui-unresolved', 'ui-hooks', 'ui-resumable', 'ui-query'])('%s: code and file:line', (name) => {
    const want = expected(name)
    expect(want.length).toBeGreaterThan(0)
    expect(sorted(located(name))).toEqual(want)
  })

  it('clean fixture: one tree per mount, nothing reported', () => {
    const r = run('ui-clean')
    expect(r.errors).toEqual([])
    expect(r.trees.map((t) => [t.line, t.provides, t.root.kind])).toEqual([[29, ['UserRepo'], 'component']])
    // Every list member is in the tree at its own line: `Effect.all(ids.map(...))` renders UserCard.
    const names: string[] = []
    const walk = (n: UiNode): void => { if (n.kind === 'component') names.push(`${n.name}:${n.line}`); if ('children' in n) n.children.forEach(walk) }
    walk(r.trees[0]!.root)
    expect(names).toEqual(expect.arrayContaining(['UserCard:24', 'Avatar:16', 'Stamp:25']))
  })

  it('ui-hooks: the ui Store stays a requirement in the tree; a same-named app Tag is printed with its file', () => {
    const r = run('ui-hooks')
    const reqs = (n: UiNode): string[] => (n.kind === 'unresolved' ? [] : [...(n.kind === 'catch' ? [] : n.requires), ...n.children.flatMap(reqs)])
    expect(reqs(r.trees[0]!.root)).toContain('Store')
    expect(r.errors.find((e) => e.line === 22)?.message).toContain('requires "app.ts#Store"')
  })

  it('ui-resume-clean: one tree per resume, one child per handler, nothing reported', () => {
    const r = run('ui-resume-clean')
    expect(r.errors).toEqual([])
    expect(r.trees.map((t) => [t.provides, t.root.kind === 'component' && t.root.children.map((c) => c.kind === 'component' && c.requires)])).toEqual([[['Repo'], [['Repo'], ['Store'], []]]])
  })

  it('non-ui projects have no trees', () => {
    expect(run('kit-app')).toEqual({ trees: [], errors: [] })
  })
})
