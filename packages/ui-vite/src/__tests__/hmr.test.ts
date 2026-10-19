import { parseSync } from 'vite'
import { describe, expect, it } from 'vitest'
import { sleekstack } from '../index.js'

const PRAGMA = '/** @jsxImportSource @sleekstack/ui */\n'

const transform = (code: string, config: { command: 'serve' | 'build' }, options = {}) => {
  const plugin = sleekstack(options)
    .flat()
    .find((p) => (p as { name?: string }).name === 'sleekstack:ids') as any
  plugin.configResolved({ root: '/app', ...config })
  plugin.buildStart()
  return plugin.transform.handler.call(
    {
      error: (m: string) => {
        throw new Error(m)
      },
    },
    code,
    '/app/c.tsx',
  )?.code as string | undefined
}
const dev = { command: 'serve' } as const

describe('sleekstack() hmr', () => {
  it('registers a components-only module with acceptUpdate and self-accepts', () => {
    const out = transform(`${PRAGMA}export const A = () => null\nexport default function B() { return null }`, dev)!
    expect(out).toContain('__sleekstack_accept(i, f)')
    expect(out).toContain('"@sleekstack/ui/internal"')
    expect(out).toContain('sleekstackShape')
  })

  it('reloads the page when the module exports anything else', () => {
    for (const extra of [
      'export const n = 1',
      'export enum Mode { A }',
      'export namespace Config { export const n = 1 }',
      "export { x } from './x'",
      "export * from './x'",
    ]) {
      const out = transform(`${PRAGMA}export const A = () => null\n${extra}`, dev)!
      expect(out).toContain('sleekstackShape')
      expect(out).not.toContain('__sleekstack_accept')
    }
  })

  it('a module that stops exporting components still reports its new shape to the previous accept callback', () => {
    expect(transform(`${PRAGMA}export const n = 1`, dev)).toContain('sleekstackShape')
  })

  it('reloads when a helper edited beneath a components-only boundary would be absorbed by it', () => {
    const plugin = sleekstack()
      .flat()
      .find((p) => (p as { name?: string }).name === 'sleekstack:ids') as any
    plugin.configResolved({ root: '/app', command: 'serve' })
    plugin.buildStart()
    const ctx = {
      error: (m: string) => {
        throw new Error(m)
      },
    }
    plugin.transform.handler.call(ctx, `${PRAGMA}export const A = () => null`, '/app/A.tsx')
    const sent: unknown[] = []
    const env = { name: 'client', hot: { send: (m: unknown) => sent.push(m) } }
    const helper = { file: '/app/helper.ts', importers: new Set([{ file: '/app/A.tsx', importers: new Set() }]) }
    expect(plugin.hotUpdate.call({ environment: env }, { file: '/app/helper.ts', modules: [helper] })).toEqual([])
    expect(sent).toEqual([{ type: 'full-reload' }])
    // The boundary's own edit, and a helper no boundary imports, update as usual.
    expect(
      plugin.hotUpdate.call(
        { environment: env },
        { file: '/app/A.tsx', modules: [helper.importers.values().next().value] },
      ),
    ).toBeUndefined()
    expect(
      plugin.hotUpdate.call(
        { environment: env },
        { file: '/app/x.ts', modules: [{ file: '/app/x.ts', importers: new Set() }] },
      ),
    ).toBeUndefined()
    expect(sent).toHaveLength(1)
  })

  it('emits parseable code whatever the module ends with', () => {
    for (const src of [
      'export const n = 1',
      'export const A = () => null',
      'export const A = () => null\nexport const n = 1',
    ]) {
      expect(parseSync('c.tsx', transform(`${PRAGMA}${src}`, dev)!, { lang: 'tsx' }).errors).toEqual([])
    }
  })

  it('ignores type exports when judging components-only', () => {
    const out = transform(`${PRAGMA}export const A = () => null\nexport type P = {}\nexport interface Q {}`, dev)!
    expect(out).toContain('sleekstackShape')
  })

  it('adds no HMR code with hmr: false, in a build, or to a React guest', () => {
    const src = `${PRAGMA}export const A = () => null`
    expect(transform(src, dev, { hmr: false })).not.toContain('import.meta.hot')
    expect(transform(src, { command: 'build' })).not.toContain('import.meta.hot')
    expect(transform('export const A = () => null', dev)).toBeUndefined()
  })
})
