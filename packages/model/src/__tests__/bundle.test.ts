import * as path from 'node:path'
import { build, type Rolldown } from 'vite'
import { expect, it } from 'vitest'

it('a bundle importing only @sleekstack/model has no react and no router code', { timeout: 60_000 }, async () => {
  const out = (await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      lib: { entry: path.join(__dirname, '../index.ts'), formats: ['es'] },
      rolldownOptions: { external: [/^effect(\/|$)/] },
    },
  })) as Array<Rolldown.RolldownOutput>
  const modules = out
    .flatMap((o) => o.output)
    .flatMap((c) => (c.type === 'chunk' ? Object.entries(c.modules) : []))
    .filter(([, m]) => m.renderedLength > 0)
    .map(([id]) => id)
  expect(modules.some((id) => id.includes('/ui/'))).toBe(true)
  expect(modules.filter((id) => /[\\/](react|react-dom|scheduler)[\\/]|[\\/]router[\\/]/.test(id))).toEqual([])
})
