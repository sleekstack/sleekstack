import { fileURLToPath } from 'node:url'
import { build, type Rolldown } from 'vite'
import { describe, expect, it } from 'vitest'
import { sleekstack } from '../index.js'

const root = fileURLToPath(new URL('./fixtures/ids', import.meta.url))
const ID = Symbol.for('@sleekstack/ui/component-id')

const bundle = async (input: Record<string, string>) =>
  (await build({
    root,
    logLevel: 'silent',
    configFile: false,
    plugins: [sleekstack()],
    build: { write: false, minify: false, rollupOptions: { input, preserveEntrySignatures: 'exports-only' } },
  })) as Rolldown.RolldownOutput

let evaluations = 0
/** A fresh evaluation of the bundled module: new function objects each time. */
const evaluate = async (code: string) =>
  import(`data:text/javascript,${encodeURIComponent(`${code}\n//${evaluations++}`)}`)

const idOf = (value: unknown) => (value as Record<symbol, unknown>)[ID]
const idsOf = (mod: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(mod).flatMap(([ns, value]) =>
      typeof value === 'function'
        ? [[ns, idOf(value)]]
        : Object.entries(value as object).map(([name, v]) => [`${ns}.${name}`, idOf(v)]),
    ),
  )

describe('sleekstack() component ids', () => {
  it('ids each declared export by file and export name, keeps them across re-export and re-evaluation', async () => {
    const out = await bundle({ index: `${root}/index.ts` })
    const code = out.output[0].code
    const first = await evaluate(code)
    const second = await evaluate(code)
    expect(second.components.Counter).not.toBe(first.components.Counter)
    expect(idsOf(first)).toEqual({
      'components.Counter': 'components#Counter',
      'components.Card': 'components#Card',
      'components.default': 'components#default',
      'components.Renamed': 'components#Renamed',
      'components.label': undefined,
      'alias.Counter': 'components#Counter',
      'alias.Alias': 'components#Counter',
      'alias.Own': 'alias#Own',
      arrow: 'defaults/arrow#default',
      declaration: 'defaults/declaration#default',
    })
    expect(idsOf(second)).toEqual(idsOf(first))
  })

  it('fails the build when two files give the same id', async () => {
    await expect(bundle({ a: `${root}/dup/a.tsx`, b: `${root}/dup/a.jsx` })).rejects.toThrow(
      /duplicate component id "dup\/a#A"/,
    )
  })

  it('gives non-function exports no id, so they never collide', async () => {
    await expect(bundle({ a: `${root}/dup/meta.tsx`, b: `${root}/dup/meta.jsx` })).resolves.toBeDefined()
  })
})

describe('sleekstack() ids in dev re-transforms', () => {
  it('releases a file ids when an edit removes its last component export', () => {
    const plugin = sleekstack()
      .flat()
      .find((p) => (p as { name?: string }).name === 'sleekstack:ids') as any
    plugin.configResolved({ root })
    plugin.buildStart()
    const ctx = {
      error(msg: string) {
        throw new Error(msg)
      },
    }
    const run = (file: string, code: string) => plugin.transform.handler.call(ctx, code, `${root}/${file}`)
    const pragma = '/** @jsxImportSource @sleekstack/ui */\n'
    run('x.tsx', `${pragma}export function A() { return null }`)
    run('x.tsx', `${pragma}export const n = 1`)
    expect(() => run('x.jsx', `${pragma}export function A() { return null }`)).not.toThrow()
  })
})
