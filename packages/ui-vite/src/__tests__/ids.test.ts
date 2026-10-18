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

const idsOf = (mod: Record<string, Record<string, unknown>>) =>
  Object.fromEntries(
    Object.entries(mod).flatMap(([ns, exports]) =>
      Object.entries(exports).map(([name, value]) => [`${ns}.${name}`, (value as Record<symbol, unknown>)[ID]]),
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
    })
    expect(idsOf(second)).toEqual(idsOf(first))
  })

  it('fails the build when two files give the same id', async () => {
    await expect(bundle({ a: `${root}/dup/a.tsx`, b: `${root}/dup/a.jsx` })).rejects.toThrow(
      /duplicate component id "dup\/a#A"/,
    )
  })
})
