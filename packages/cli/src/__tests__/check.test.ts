import { spawnSync } from 'node:child_process'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { main } from '../check'

const fixture = (name: string) => path.join(__dirname, 'fixtures', name)
const run = (cwd: string, ...args: string[]) => {
  let out = ''
  let err = ''
  const code = main(['check', ...args], { cwd, out: (s) => (out += s), err: (s) => (err += s) })
  return { code, out, err }
}

describe('sleekstack check', () => {
  it('reports every configureRuntime root independently, skips test files, exits 1 on violations', () => {
    const r = run(fixture('multi'), '--json')
    expect(r.code).toBe(1)
    const roots = JSON.parse(r.out).roots.map((x: { file: string; errors: { code: string }[] }) => [x.file, x.errors.map((e) => e.code)])
    expect(roots.sort()).toEqual([['bad.ts', ['MissingDependency']], ['good.ts', []]])
  })

  it('--entry limits the roots', () => {
    expect(run(fixture('multi'), '--entry', 'good.ts').code).toBe(0)
  })

  it('sleekstack.entry in package.json limits the roots', () => {
    expect(run(fixture('entry'), '--json').code).toBe(0)
  })

  it('zero roots exits 2 with usage', () => {
    const r = run(fixture('none'))
    expect(r.code).toBe(2)
    expect(r.err).toMatch(/No roots[\s\S]*Usage: sleekstack check/)
  })

  it('ui project: a component error exits 1 with file:line code; a clean ui-only project exits 0', () => {
    const bad = run(fixture('ui/bad'))
    expect(bad.code).toBe(1)
    expect(bad.err).toMatch(/app\.ts:9 MissingDependency: /)
    const clean = run(fixture('ui/clean'), '--json')
    expect(clean.code).toBe(0)
    expect(JSON.parse(clean.out).components.trees).toHaveLength(1)
  })

  it('non-ui project: --json carries no components key', () => {
    expect(JSON.parse(run(fixture('entry'), '--json').out)).not.toHaveProperty('components')
  })

  it('a crash exits 2', () => {
    const r = run(fixture('none'), '--project', 'missing.json', '--json')
    expect([r.code, r.out]).toEqual([2, ''])
    expect(r.err).toMatch(/crashed/)
  })

  it('showcase-kit: valid JSON only on stdout, exit 0', () => {
    const r = run(path.join(__dirname, '../../../../apps/showcase-kit'), '--json', '--entry', 'src/server/runtime.server.ts')
    expect(r.code).toBe(0)
    const json = JSON.parse(r.out)
    expect(json.ok).toBe(true)
    // Kit action bodies pass no request layer of their own: no extra roots.
    expect(json.roots.map((x: { kind: string }) => x.kind)).toEqual(['app'])
  }, 30_000)

  it('showcase: RequestLive and DemoLive are request/overrides roots over the app, exit 0', () => {
    const r = run(path.join(__dirname, '../../../../apps/showcase'), '--entry', 'src/delivery/runtime.server.ts')
    expect(r.code).toBe(0)
    expect(r.err).toMatch(/ok {3}\[app\] [\s\S]*ok {3}\[request\] RequestLive [\s\S]*ok {3}\[overrides\] DemoLive /)
    expect(r.err.match(/\[(request|overrides)\]/g)).toEqual(['[request]', '[overrides]'])
  }, 30_000)

  it('an unresolvable runEffect layer fails by default; --lenient makes it an opaque root, exit 0', () => {
    expect(run(fixture('lenient'), '--json').code).toBe(1)
    const r = run(fixture('lenient'), '--json', '--lenient')
    expect(r.code).toBe(0)
    const json = JSON.parse(r.out)
    expect(json.ok).toBe(true)
    expect(json.roots.map((x: { kind: string; file: string; line: number }) => [x.kind, x.file, x.line])).toEqual([['app', 'runtime.ts', 6], ['opaque', 'runtime.ts', 9]])
  })

  it.each([
    [['--version'], 0, /^0\.0\.1/],
    [['help'], 0, /Usage: sleekstack <command>/],
    [['bogus'], 2, /Usage: sleekstack <command>/],
  ])('bin %j keeps the informational commands', (args, status, out) => {
    const r = spawnSync(process.execPath, [path.join(__dirname, '../../bin/cli.js'), ...args], { encoding: 'utf8' })
    expect(r.status).toBe(status)
    expect(r.stdout).toMatch(out)
  })
})
