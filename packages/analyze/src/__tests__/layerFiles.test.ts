import * as fs from 'node:fs'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeLayerFiles, ERROR_CODES } from '../index'

const fixture = path.join(__dirname, 'fixtures', 'layer-files')
const report = analyzeLayerFiles({ project: path.join(fixture, 'tsconfig.json') })
const at = ({ file, line }: { readonly file: string; readonly line: number }) => `${file}:${line}`
const message = (file: string) => report.errors.find((e) => e.file === path.join(...file.split('/')))?.message

describe('analyzeLayerFiles', () => {
  it('reports each diagnostic at its file:line, with its code docs; a Layer under test/ is not read', () => {
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

  it('composes by requirement, files that do not depend on each other by path codepoint, a cycle last', () => {
    expect(report.layerFiles.map((f) => [f.file.split(path.sep).join('/'), f.provides, f.requires])).toEqual([
      ['dup/one.layer.ts', ['Clock'], []],
      ['dup/two.layer.ts', ['Clock'], []],
      ['mail.layer.ts', ['Mail'], ['Smtp']],
      ['src/z-config.layer.ts', ['Config'], []],
      ['src/db.layer.ts', ['Db'], ['Config']],
      ['src/a-repo.layer.ts', ['Repo'], ['Db']],
      ['cycle/ping.layer.ts', ['Ping'], ['Pong']],
      ['cycle/pong.layer.ts', ['Pong'], ['Ping']],
    ])
  })

  it.each([
    ['cycle/pong.layer.ts', 'Layer File cycle: cycle/ping.layer.ts -> cycle/pong.layer.ts -> cycle/ping.layer.ts'],
    ['dup/two.layer.ts', 'Tag "Clock" is provided by two Layer Files: "dup/one.layer.ts" and "dup/two.layer.ts"'],
    ['mail.layer.ts', 'Layer File "mail.layer.ts" requires "Smtp", which no Layer File provides'],
    ['empty.layer.ts', 'Layer File "empty.layer.ts" has no default export; export default a Layer'],
    ['untyped.layer.ts', 'Layer File "untyped.layer.ts" has a default export typed `any`; write out its Layer type'],
    ['number.layer.ts', 'Layer File "number.layer.ts" has a default export that is not a Layer'],
    ['server/_app.ts', 'Server Root "server/_app.ts" exports "stray"; it takes only onError'],
  ])('%s says what is wrong', (file, expected) => {
    expect(message(file)?.split(path.sep).join('/')).toBe(expected)
  })

  it('reads the Server Root and its onError', () => {
    expect(report.serverRoot).toEqual({ file: path.join('server', '_app.ts'), onError: true })
  })
})
