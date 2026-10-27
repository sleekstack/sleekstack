import * as path from 'node:path'
import { build, type Rolldown } from 'vite'
import { expect, it } from 'vitest'

const src = path.join(__dirname, '..')
const ENTRY = 'virtual-entry'

/** The ids of the modules that render code into a bundle of `code`, an entry module importing from `src`. */
const bundled = async (code: string) => {
  const out = (await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'entry',
        resolveId: (id) => (id.endsWith(ENTRY) ? `\0${ENTRY}` : undefined),
        load: (id) => (id === `\0${ENTRY}` ? code.replaceAll('$src', src) : undefined),
      },
    ],
    build: {
      write: false,
      lib: { entry: ENTRY, formats: ['es'], fileName: 'entry' },
      rolldownOptions: { external: [/^effect(\/|$)/] },
    },
  })) as Array<Rolldown.RolldownOutput>
  return out
    .flatMap((o) => o.output)
    .flatMap((c) => (c.type === 'chunk' ? Object.entries(c.modules) : []))
    .filter(([, m]) => m.renderedLength > 0)
    .map(([id]) => id)
}

const RECORDS = /[\\/]model[\\/]src[\\/](adapter|commit|errors|query|record|registry|relations|transformation)\.ts$/
const QUERY = /[\\/]query[\\/](src|dist)[\\/]|[\\/]@tanstack[\\/]query-core[\\/]/

it('a bundle importing only @sleekstack/model has no react and no router code', { timeout: 60_000 }, async () => {
  const modules = await bundled(`export * from '$src/index.ts'`)
  expect(modules.some((id) => id.includes('/ui/'))).toBe(true)
  expect(modules.filter((id) => /[\\/](react|react-dom|scheduler)[\\/]|[\\/]router[\\/]/.test(id))).toEqual([])
})

it('a Draft-only bundle holds no records or query code', { timeout: 60_000 }, async () => {
  const modules = await bundled(`export { useDraft } from '$src/index.ts'`)
  expect(modules.some((id) => id.endsWith('draft.ts'))).toBe(true)
  expect(modules.filter((id) => RECORDS.test(id) || QUERY.test(id))).toEqual([])
})

it('only the ./query entry pulls in @sleekstack/query', { timeout: 60_000 }, async () => {
  expect((await bundled(`export * from '$src/index.ts'`)).filter((id) => QUERY.test(id))).toEqual([])
  expect((await bundled(`export * from '$src/query.ts'`)).some((id) => QUERY.test(id))).toBe(true)
})
