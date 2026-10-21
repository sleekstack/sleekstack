import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeServerServices, ERROR_CODES } from '../index'

const dir = (name: string) => path.join(__dirname, 'fixtures', name)
const run = (name: string) => analyzeServerServices({ project: path.join(dir(name), 'tsconfig.json') })
/** Every `// @error Code` marker in a fixture, as the error the pass must report on that line. */
const expected = (name: string) =>
  fs
    .readdirSync(dir(name))
    .filter((f) => f.endsWith('.ts'))
    .sort()
    .flatMap((file) =>
      fs
        .readFileSync(path.join(dir(name), file), 'utf8')
        .split('\n')
        .flatMap((l, i) => {
          const m = /\/\/ @error (\w+)/.exec(l)
          return m ? [{ code: m[1]!, file, line: i + 1 }] : []
        }),
    )

describe('analyzeServerServices', () => {
  it('reads a valid contract: Tag id, class, methods and their raw types', () => {
    const r = run('server-service-valid')
    expect(r.errors).toEqual([])
    expect(r.services.map((s) => [s.id, s.name, s.location.file])).toEqual([['Profiles', 'Profiles', 'contract.ts']])
    const types = r.services[0]!.methods.map((m) => [
      m.name,
      m.input && r.checker.typeToString(m.input),
      r.checker.typeToString(m.success),
      r.checker.typeToString(m.error),
    ])
    expect(types).toEqual([
      ['rename', '{ readonly name: string; }', '{ readonly name: string; }', 'NameTaken'],
      ['list', undefined, 'readonly Profile[]', 'never'],
      ['get', 'Ids', 'Profile', 'NameTaken'],
    ])
  })

  it('finds a contract whose ServerService import and export go through barrels', () => {
    const r = run('server-service-barrel')
    expect(r.errors).toEqual([])
    expect(r.services.map((s) => [s.id, s.location.file, s.methods.map((m) => m.name)])).toEqual([
      ['Accounts', 'contract.ts', ['count']],
    ])
  })

  it.each([
    'server-service-in-server-file',
    'server-service-value-export',
    'server-service-imports-server',
    'server-service-two-params',
    'server-service-non-effect',
    'server-service-requires',
    'server-service-any',
    'server-service-duplicate-id',
    'server-service-indirect',
    'server-service-start-missing',
    'server-boundary',
  ])('%s: code and file:line', (name) => {
    const errors = run(name).errors
    expect(errors.map(({ code, file, line }) => ({ code, file, line }))).toEqual(expected(name))
    for (const e of errors) expect(e.docs).toBe(ERROR_CODES[e.code].docs)
  })

  it("is silent when start's layer provides every registered Tag", () => {
    expect(run('server-service-start-ok').errors).toEqual([])
  })

  it('names the Tag a start({ services }) layer does not provide', () => {
    expect(run('server-service-start-missing').errors.map((e) => e.message)).toEqual([
      'Server Service "Accounts" is registered in start({ services }) but start\'s layer does not provide it',
    ])
  })

  it('names the import chain of a server file reachable from the browser', () => {
    expect(run('server-boundary').errors.map((e) => e.message)).toEqual([
      'The server-only "direct.server.ts" is reachable from the browser: main.ts -> direct.server.ts',
      'The server-only "deep.server.ts" is reachable from the browser: main.ts -> page.ts -> deep.server.ts',
      'The server-only "lazy.server.ts" is reachable from the browser: main.ts -> page.ts -> lazy.server.ts',
    ])
  })

  it('is silent for type-only imports and server files only server code imports', () => {
    expect(run('server-boundary-clean').errors).toEqual([])
  })

  it('names both files of a duplicated Tag id', () => {
    expect(run('server-service-duplicate-id').errors[0]!.message).toBe(
      'Server Service Tag id "Profiles" is declared by several classes: A (a.ts:4), B (b.ts:4)',
    )
  })
})
