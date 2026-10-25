import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeRpc, ERROR_CODES } from '../index'

const fixture = (name: string) => path.join(__dirname, 'fixtures', name)
const run = (name: string) => analyzeRpc({ project: path.join(fixture(name), 'tsconfig.json') })
const report = run('rpc')
const at = ({ file, line }: { readonly file: string; readonly line: number }) => `${file}:${line}`
const posix = (s: string) => s.split(path.sep).join('/')
const messageAt = (file: string, text: string) => {
  const line =
    fs
      .readFileSync(path.join(fixture('rpc'), file), 'utf8')
      .split('\n')
      .findIndex((l) => l.includes(text)) + 1
  return report.errors.filter((e) => posix(e.file) === file && e.line === line).map((e) => posix(e.message))
}

describe('analyzeRpc', () => {
  it.each(['rpc', 'rpc-manifest-shape'])('%s: reports each diagnostic at its file:line, with its code docs', (name) => {
    const expected = (fs.readdirSync(fixture(name), { recursive: true }) as string[])
      .filter((f) => f.endsWith('.ts'))
      .flatMap((file) =>
        fs
          .readFileSync(path.join(fixture(name), file), 'utf8')
          .split('\n')
          .flatMap((l, i) => {
            const m = /\/\/ @error (\w+)/.exec(l)
            return m ? [`${m[1]} ${at({ file, line: i + 1 })}`] : []
          }),
      )
    const { errors } = run(name)
    expect(errors.map((e) => `${e.code} ${at(e)}`).sort()).toEqual(expected.sort())
    for (const e of errors) expect(e.docs).toBe(ERROR_CODES[e.code].docs)
  })

  it('reads each accepted form as a method, names a service by its file or `service`, skips options and values', () => {
    expect(report.services.map((s) => [s.name, posix(s.file), s.methods.map((m) => m.name)])).toEqual([
      ['Clock', 'server/clock.rpc.ts', ['now']],
      ['Journal', 'server/journal.rpc.ts', ['read']],
      ['Notes', 'server/notes.rpc.ts', ['add', 'delete', 'get', 'list', 'rename']],
      ['Broken', 'server/rpc.ts', []],
      ['Clock', 'server/rpc.ts', ['now']],
      ['Items', 'server/rpc.ts', ['get', 'note']],
      ['Ping', 'server/rpc.ts', ['now']],
      ['Tally', 'server/rpc.ts', ['add', 'get']],
    ])
  })

  it('reads RPC input as written and the tagged errors, a wrapped Controller Method with plain numbers', () => {
    const method = (service: string, name: string) =>
      report.services.find((s) => s.name === service && s.methods.length)!.methods.find((m) => m.name === name)!
    const object = (name: string, type: unknown) => ({ kind: 'object', properties: [{ name, optional: false, type }] })
    expect(method('Notes', 'add').schema.input).toEqual({ kind: 'ref', file: 'schemas.ts', name: 'Note' })
    expect(method('Notes', 'delete').schema.input).toEqual({ kind: 'number' })
    expect(method('Notes', 'get').schema.error.map((e) => e.name)).toEqual(['Missing'])
    expect(method('Items', 'get').schema.input).toEqual(object('params', object('id', { kind: 'number' })))
    expect(method('Tally', 'add').schema.error.map((e) => e.name)).toEqual(['TallyLimit'])
    expect(method('Tally', 'add').controller).toEqual({ route: 'api/tally', method: 'POST' })
    // A class Controller's generator method, read through its `Gen`.
    expect(method('Items', 'note').schema.input).toEqual(object('params', object('id', { kind: 'number' })))
    expect(method('Items', 'note').schema.success).toEqual({ kind: 'string' })
    expect(method('Items', 'note').controller).toEqual({ route: 'api/notes/[id]', method: 'GET' })
  })

  it.each([
    [
      'server/journal.rpc.ts',
      'service',
      'Tag name "Journal" is used by ServerService "Diary" (contracts.ts:4) and RPC File "server/journal.rpc.ts"',
    ],
    [
      'server/clock.rpc.ts',
      'import',
      'Tag name "Clock" is used by Layer File "clock.layer.ts" and RPC File "server/clock.rpc.ts"',
    ],
    [
      'server/rpc.ts',
      'Ping:',
      'Tag name "Ping" is used by serverFn (server/fns.ts:4) and RPC Manifest "server/rpc.ts" (server/rpc.ts:4)',
    ],
    [
      'server/rpc.ts',
      'Clock:',
      'Tag name "Clock" is used by Layer File "clock.layer.ts" and RPC Manifest "server/rpc.ts" (server/rpc.ts:5)',
    ],
    [
      'server/2fa.rpc.ts',
      'one',
      'RPC File "server/2fa.rpc.ts" names its service "2fa", which is not of the form [A-Za-z][A-Za-z0-9]*; export `service`',
    ],
    [
      'server/rpc.ts',
      'loose',
      'RPC Manifest entry "Broken.loose" (PUT api/tally) is typed with `any`; write out the types',
    ],
    [
      'server/rpc.ts',
      'missing',
      'RPC Manifest entry "Broken.missing" (DELETE api/tally): Controller "server/routes/api/tally.controller.ts" does not export DELETE',
    ],
    [
      'server/rpc.ts',
      'method',
      'RPC Manifest entry "Broken.method" (DELETE api/notes/[id]): Controller "server/routes/api/notes/[id].controller.ts" has no generator method DELETE in its Controller class',
    ],
    [
      'server/rpc.ts',
      'raw',
      'RPC Manifest entry "Broken.raw" (GET api/raw) returns a Response; a wrapped method returns its value, or write an RPC File',
    ],
    [
      'server/notes.rpc.ts',
      'linked',
      'RPC method "Notes.linked" requires the generated "Notes"; a generated service cannot require another',
    ],
    [
      'server/notes.rpc.ts',
      'boom',
      'RPC method "Notes.boom" fails with "Boom" of the server-only "errors.server.ts"; declare the error class in a client-safe module: the generated client imports it, virtual:sleek/rpc -> errors.server.ts',
    ],
    [
      'server/notes.rpc.ts',
      'local =',
      'RPC method "Notes.local" fails with "Local" of the server-only "server/notes.rpc.ts"; declare the error class in a client-safe module: the generated client imports it, virtual:sleek/rpc -> server/notes.rpc.ts',
    ],
  ])('%s (%s): one diagnostic that names both sides', (file, text, expected) => {
    expect(messageAt(file, text)).toEqual([expected])
  })
})
