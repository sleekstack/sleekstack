import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeControllers, controllerRoute, ERROR_CODES } from '../index'

const fixture = path.join(__dirname, 'fixtures', 'controllers')
const report = analyzeControllers({ project: path.join(fixture, 'tsconfig.json') })
const at = ({ file, line }: { readonly file: string; readonly line: number }) => `${file}:${line}`

describe('controllerRoute', () => {
  const dir = path.join(path.sep, 'app', 'server', 'routes')
  const route = (file: string) => controllerRoute(dir, path.join(dir, file))

  it.each([
    ['index.controller.ts', 'index', '/'],
    ['users/[id].controller.ts', 'users/[id]', '/users/:id'],
    ['(admin)/stats/index.controller.ts', '(admin)/stats/index', '/stats'],
    ['docs/[[lang]].controller.ts', 'docs/[[lang]]', '/docs/:lang?'],
    ['files/[...path].controller.ts', 'files/[...path]', '/files/*path'],
  ])('%s is the route %s at %s', (file, name, pattern) => {
    expect(route(file)).toEqual({ route: name, pattern })
  })

  it('a file under a `_` file or directory is not a route', () => {
    expect(route('_lib/x.controller.ts')).toBeUndefined()
  })

  it.each([
    ['../other.controller.ts', 'it is outside the Controllers directory'],
    ['[...all]/x.controller.ts', 'an optional or splat segment must be the last one'],
    ['[[lang]]/x.controller.ts', 'an optional or splat segment must be the last one'],
    ['a b.controller.ts', 'segment "a b" is neither a name'],
  ])('%s throws naming the file', (file, why) => {
    expect(() => route(file)).toThrow(`sleekstack: invalid Controller file ${path.join(dir, file)}: ${why}`)
  })
})

describe('analyzeControllers', () => {
  it('reports each diagnostic at its file:line, with its code docs', () => {
    const expected = (fs.readdirSync(fixture, { recursive: true }) as string[])
      .filter((f) => f.endsWith('.ts'))
      .flatMap((file) =>
        fs
          .readFileSync(path.join(fixture, file), 'utf8')
          .split('\n')
          .flatMap((l, i) => {
            const m = /\/\/ @error (\w+)/.exec(l)
            return m ? [`${m[1]} ${at({ file, line: i + 1 })}`] : []
          }),
      )
    expect(report.errors.map((e) => `${e.code} ${at(e)}`).sort()).toEqual(expected.sort())
    for (const e of report.errors) expect(e.docs).toBe(ERROR_CODES[e.code].docs)
  })

  it('reads a clean Controller: string codecs on printed params and query, references kept, success when written', () => {
    const users = report.controllers.find((c) => c.route === 'users/[id]')!
    const prop = (name: string, type: unknown, optional = false) => ({ name, optional, type })
    const object = (...properties: unknown[]) => ({ kind: 'object', properties })
    const ref = (name: string) => ({ kind: 'ref', file: 'schemas.ts', name })
    expect(users.pattern).toBe('/users/:id')
    expect(users.methods.map((m) => [m.name, m.schema])).toEqual([
      [
        'GET',
        {
          input: object(
            prop('params', object(prop('id', { kind: 'number', codec: 'string' }))),
            prop('query', ref('Page')),
          ),
          success: ref('User'),
        },
      ],
      ['PUT', { input: object(prop('params', ref('Params')), prop('body', ref('User'))), success: undefined }],
      [
        'PATCH',
        {
          input: object(
            prop('params', object(prop('id', ref('Id')))),
            prop(
              'query',
              object(
                prop(
                  'dry',
                  { kind: 'union', members: [{ kind: 'undefined' }, { kind: 'boolean', codec: 'string' }] },
                  true,
                ),
                prop('ids', { kind: 'array', readonly: true, element: { kind: 'number', codec: 'string' } }),
              ),
            ),
          ),
          success: { kind: 'void' },
        },
      ],
    ])
    expect(report.controllers.find((c) => c.route === 'users/index')?.methods.map((m) => m.schema)).toEqual([
      { input: { kind: 'void' }, success: undefined },
    ])
  })

  it('a service a directory wrap discharges is provided only to the Controllers beneath it', () => {
    expect(report.errors.filter((e) => e.code === 'MissingDependency').map((e) => e.message)).toEqual([
      'Controller "missing" GET requires "Audit", which no wrap above it and no start({ layer }) provides',
      'Controller "missing" POST requires "Viewer", which no wrap above it and no start({ layer }) provides',
    ])
  })

  it.each([
    [
      'near-miss.controller.ts',
      3,
      'Controller "near-miss" exports "get", which is not served; a method is a named export GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
    ],
    [
      'bad-input.controller.ts',
      4,
      'Controller "bad-input" POST takes the unknown input key "foo"; the input is `{ params?, query?, body? }`',
    ],
    [
      'bad-input.controller.ts',
      5,
      'Controller "bad-input" GET takes a `body`, which GET cannot have; only POST, PUT, PATCH and DELETE do',
    ],
    [
      'bad-input.controller.ts',
      6,
      'Controller "bad-input" PUT reads its whole input from a Schema reference; reference a Schema for params, query or body',
    ],
    [
      'bad-input.controller.ts',
      9,
      'Controller "bad-input" OPTIONS reads query.n as `object`; query is an object of strings or arrays of strings',
    ],
    [
      'items/[id].controller.ts',
      4,
      'Controller "items/[id]" GET declares params "uid", but its path /items/:id has "id"',
    ],
    [
      'items/[id].controller.ts',
      6,
      'Controller "items/[id]" DELETE declares params none, but its path /items/:id has "id"',
    ],
    [
      'items/[id].controller.ts',
      7,
      'Controller "items/[id]" PUT reads params.id from the Schema "Count" of "schemas.ts", which does not encode to strings',
    ],
    [
      'items/[id].controller.ts',
      8,
      'Controller "items/[id]" POST reads params from the Schema "Nested" of "schemas.ts", which does not encode to an object of strings',
    ],
  ])('%s:%i says what is wrong', (file, line, message) => {
    const found = report.errors.find((e) => e.file === path.join('server', 'routes', file) && e.line === line)
    expect(found?.message).toBe(message)
  })
})
