import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeServerServices, ERROR_CODES } from '../index'

const dir = (name: string) => path.join(__dirname, 'fixtures', name)
const run = (name: string) => analyzeServerServices({ project: path.join(dir(name), 'tsconfig.json') })

const str = { kind: 'string' } as const
const num = { kind: 'number' } as const
const bool = { kind: 'boolean' } as const
const voidT = { kind: 'void' } as const
const prop = (name: string, type: unknown, optional = false) => ({ name, optional, type })
const nameField = prop('name', str)
const io = (input: unknown, success: unknown = voidT) => ({ input, success, error: [] })

describe('Type to Schema', () => {
  const kinds = run('server-service-types')
  const schemas = new Map(kinds.services[0]!.methods.map((m) => [m.name, m.schema]))

  it('reads the fixture without errors', () => expect(kinds.errors).toEqual([]))

  // Union members come in the checker's order.
  it.each<[string, unknown]>([
    [
      'primitives',
      io({
        kind: 'object',
        properties: [
          prop('s', str),
          prop('n', num),
          prop('b', bool),
          prop('z', { kind: 'null' }),
          prop('u', { kind: 'undefined' }),
        ],
      }),
    ],
    [
      'literals',
      io(
        {
          kind: 'union',
          members: [
            { kind: 'literal', value: true },
            { kind: 'literal', value: 'a' },
            { kind: 'literal', value: 1 },
          ],
        },
        { kind: 'undefined' },
      ),
    ],
    ['unions', io({ kind: 'union', members: [{ kind: 'null' }, str, num, bool] })],
    ['arrays', io({ kind: 'array', readonly: true, element: num }, { kind: 'array', readonly: false, element: str })],
    [
      'optional',
      io({
        kind: 'object',
        properties: [prop('name', { kind: 'union', members: [{ kind: 'undefined' }, str] }, true)],
      }),
    ],
    [
      'nested',
      io(
        { kind: 'object', properties: [nameField, prop('tags', { kind: 'array', readonly: true, element: str })] },
        { kind: 'object', properties: [prop('owner', { kind: 'object', properties: [nameField] })] },
      ),
    ],
    ['voidInput', io(voidT)],
    [
      'errors',
      {
        input: voidT,
        success: voidT,
        error: [
          {
            kind: 'taggedError',
            name: 'NameTaken',
            file: 'contract.ts',
            fields: [nameField, prop('at', { kind: 'union', members: [{ kind: 'undefined' }, num] }, true)],
          },
          { kind: 'taggedError', name: 'Missing', file: 'errors.ts', fields: [] },
        ],
      },
    ],
  ])('%s', (name, expected) => {
    expect(schemas.get(name)).toEqual(expected)
  })

  it('is JSON-serializable', () => {
    const all = [...schemas.values()]
    expect(JSON.parse(JSON.stringify(all))).toEqual(all)
  })
})

describe('ServerServiceTypeNotSerializable', () => {
  const r = run('server-service-not-serializable')
  const lines = fs.readFileSync(path.join(dir('server-service-not-serializable'), 'contract.ts'), 'utf8').split('\n')
  const lineOf = (method: string) => lines.findIndex((l) => l.includes(`readonly ${method}:`)) + 1

  it('drops every unserializable method', () => expect(r.services[0]!.methods).toEqual([]))

  it.each([
    ['date', 'input.when', 'Date'],
    ['map', 'success', 'Map<string, number>'],
    ['set', 'input.ids', 'Set<string>'],
    ['instance', 'input', 'Point'],
    ['fn', 'input.cb', '() => void'],
    ['big', 'input', 'bigint'],
    ['sym', 'success.s', 'symbol'],
    ['unknown', 'input', 'unknown'],
    ['any', 'input.v', 'any'],
    ['recursive', 'input.children[]', 'Tree'],
    ['plainError', 'error', 'Plain'],
    ['taggedSuccess', 'success', 'Oops'],
    ['brand', 'input', 'string & { readonly brand: "Id"; }'],
  ])('%s: file:line and the member path', (method, member, text) => {
    const e = r.errors.find((x) => x.message.startsWith(`Server Service method "Bad.${method}":`))
    expect(e).toMatchObject({ code: 'ServerServiceTypeNotSerializable', file: 'contract.ts', line: lineOf(method) })
    expect(e!.message).toContain(`: ${member} has type "${text}"`)
    expect(e!.docs).toBe(ERROR_CODES.ServerServiceTypeNotSerializable.docs)
  })

  it('reports one error per method and nothing else', () =>
    expect(r.errors.map((e) => e.code)).toEqual(Array(13).fill('ServerServiceTypeNotSerializable')))
})
