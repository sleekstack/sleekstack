import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeControllers, controllerRoute, ERROR_CODES } from '../index'

const fixture = path.join(__dirname, 'fixtures', 'controllers')
const report = analyzeControllers({ project: path.join(fixture, 'tsconfig.json') })
const at = ({ file, line }: { readonly file: string; readonly line: number }) => `${file}:${line}`
/** Each `// @error Code` marker of the fixture `dir` as `Code file:line`. */
const markers = (dir: string) =>
  (fs.readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => f.endsWith('.ts'))
    .flatMap((file) =>
      fs
        .readFileSync(path.join(dir, file), 'utf8')
        .split('\n')
        .flatMap((l, i) => {
          const m = /\/\/ @error (\w+)/.exec(l)
          return m ? [`${m[1]} ${at({ file, line: i + 1 })}`] : []
        }),
    )

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
    expect(report.errors.map((e) => `${e.code} ${at(e)}`).sort()).toEqual(markers(fixture).sort())
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

  it('a service a directory wrap discharges is provided only to the Controllers beneath it; a wrap result requires its own; a Layer File provides to all', () => {
    expect(report.errors.filter((e) => e.code === 'MissingDependency').map((e) => e.message)).toEqual([
      'Controller "missing" GET requires "Audit", which no wrap above it, no Layer File and no start({ layer }) provides',
      'Controller "missing" POST requires "Viewer", which no wrap above it, no Layer File and no start({ layer }) provides',
      // Once for both Controllers beneath it; the inner wrap's `Viewer` comes from it.
      'The wrap of "server/routes/audited/_defaults.ts" requires "Audit", which no wrap above it, no Layer File and no start({ layer }) provides',
      // A declared Tag is provided as a method's `R` is: `users/declared`'s wrap-provided `Viewer` is not reported.
      'Controller "classes/declared" class Declared declares "audit" as "Audit", which no wrap above it, no Layer File and no start({ layer }) provides',
    ])
  })

  it('reads a default-exported class Controller as the equivalent named-export one, with its declared Tags', () => {
    const read = (route: string) => report.controllers.find((c) => c.route === route)!
    const methods = (route: string) =>
      read(route).methods.map((m) => [m.name, m.schema, report.checker.typeToString(m.requires)])
    expect(read('twin/class/[id]').kind).toBe('class')
    expect(read('twin/named/[id]')).toMatchObject({ kind: 'functions', declared: [] })
    expect(methods('twin/class/[id]')).toEqual(methods('twin/named/[id]'))
    expect(methods('twin/class/[id]').map(([name]) => name)).toEqual(['GET', 'DELETE'])
    expect(
      read('twin/class/[id]').declared.map((d) => [d.name, report.checker.typeToString(d.tag), d.location.line]),
    ).toEqual([['users', 'typeof Users', 7]])
  })

  it.each([
    [
      'classes/no-method.controller.ts',
      3,
      'Controller "classes/no-method" default-exports a class with no HTTP-named generator method; name a method GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
    ],
    [
      'classes/not-generator.controller.ts',
      5,
      'Controller "classes/not-generator" GET is not a generator method of the class; write `*GET(input: { ... }): Gen<A, E, R> { ... }`',
    ],
    [
      'classes/no-gen.controller.ts',
      6,
      'Controller "classes/no-gen" GET does not return a written `Gen<A, E, R>`; write the return type `Gen<A, E, R>` imported from `@sleekstack/start`',
    ],
    [
      // A local alias of the whole `Gen` is refused.
      'classes/no-gen.controller.ts',
      7,
      'Controller "classes/no-gen" POST does not return a written `Gen<A, E, R>`; write the return type `Gen<A, E, R>` imported from `@sleekstack/start`',
    ],
    [
      'classes/indirect.controller.ts',
      5,
      'Controller "classes/indirect" default-exports a class that does not extend `Controller(...)` of @sleekstack/start directly; write `export default class extends Controller({ ... }) { ... }`',
    ],
    [
      'classes/two-forms.controller.ts',
      8,
      'Controller "classes/two-forms" exports "POST" beside its default class; a file is one form, so make it a generator method of the class',
    ],
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

describe('analyzeControllers: records(...)', () => {
  const dir = path.join(__dirname, 'fixtures', 'records-controller')
  const records = analyzeControllers({ project: path.join(dir, 'tsconfig.json') })
  const read = (route: string) => records.controllers.find((c) => c.route === route)

  it('reports each diagnostic at its file:line, and nothing else', () => {
    expect(records.errors.map((e) => `${e.code} ${at(e)}`).sort()).toEqual(markers(dir).sort())
  })

  it.each(['articles/[id]', 'barrel/[id]'])(
    '%s serves GET and PATCH with params { id }, its record and adapter Tag (a re-export barrel too)',
    (route) => {
      const c = read(route)!
      const id = {
        kind: 'object',
        properties: [
          {
            name: 'params',
            optional: false,
            type: { kind: 'object', properties: [{ name: 'id', optional: false, type: { kind: 'string' } }] },
          },
        ],
      }
      expect(c.kind).toBe('records')
      expect([c.record?.name, c.record?.file, records.checker.typeToString(c.record!.adapter)]).toEqual([
        'Article',
        'article.ts',
        'typeof ArticleAdapter',
      ])
      expect(
        c.methods
          .filter((m) => m.name !== 'DELETE')
          .map((m) => [m.name, m.schema.input, records.checker.typeToString(m.requires)]),
      ).toEqual([
        ['GET', id, 'ArticleAdapter'],
        ['PATCH', id, 'ArticleAdapter'],
      ])
    },
  )

  it('a named DELETE beside records(...) is an ordinary Controller Method', () => {
    expect(read('articles/[id]')!.methods.map((m) => m.name)).toEqual(['GET', 'PATCH', 'DELETE'])
  })

  it.each([
    ['wrong/[slug]', "serves a record at /wrong/:slug; a served record's file path ends in exactly [id]"],
    ['local/[id]', 'default-exports a `records` call that is not `records` of @sleekstack/start; import it from there'],
    [
      'unresolvable/[id]',
      'serves "notARecord", which does not resolve to a const `defineRecord(...)`; pass the record itself',
    ],
    ['no-adapter/[id]', 'serves the record "Note", which has no adapter; give `defineRecord` an `adapter` Tag'],
    [
      'needy/[id]',
      'serves the record "Needy", whose fields need the Service "Lookup"; a served record\'s Schemas need none',
    ],
  ])('RecordsRouteShape: %s', (route, why) => {
    expect(records.errors.find((e) => e.code === 'RecordsRouteShape' && e.file.includes(route))?.message).toBe(
      `Controller "${route}" ${why}`,
    )
    expect(read(route)!.kind).toBe('functions')
  })

  it('RecordsMethodCollision: a named GET beside records(...)', () => {
    expect(records.errors.find((e) => e.code === 'RecordsMethodCollision')?.message).toBe(
      'Controller "collision/[id]" exports "GET" beside its default `records(...)`, which serves GET; remove the export or write the Controller by hand',
    )
    expect(read('collision/[id]')!.methods.map((m) => m.name)).toEqual(['GET', 'PATCH'])
  })
})
