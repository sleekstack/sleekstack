// @vitest-environment node
import * as path from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'
import { DEVTOOLS_MARKER, QUERY_DEVTOOLS_MARKER } from '../index'

// The app's chunks for `fixtures/lazyPanel.tsx`, split into the entry and everything it loads lazily; packages are external.
const chunks = async (mode: 'production' | 'development') => {
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
    build: {
      write: false,
      minify: true,
      lib: { entry: path.join(__dirname, 'fixtures/lazyPanel.tsx'), formats: ['es'] },
      rollupOptions: { external: (id) => !id.startsWith('.') && !path.isAbsolute(id) },
    },
  })
  const all = (Array.isArray(out) ? out : [out])
    .flatMap((o) => ('output' in o ? o.output : []))
    .filter((c) => c.type === 'chunk')
  const code = (entry: boolean) =>
    all
      .filter((c) => c.isEntry === entry)
      .map((c) => c.code)
      .join('\n')
  return { entry: code(true), lazy: code(false) }
}

describe('bundle', () => {
  it('a production build behind a dynamic import has no panel in any chunk', { timeout: 60_000 }, async () => {
    const { entry, lazy } = await chunks('production')
    for (const marker of [DEVTOOLS_MARKER, QUERY_DEVTOOLS_MARKER]) expect(entry + lazy).not.toContain(marker)
  })

  it('a development build loads the panel as its own chunk', { timeout: 60_000 }, async () => {
    const { entry, lazy } = await chunks('development')
    expect(entry).not.toContain(DEVTOOLS_MARKER)
    expect(lazy).toContain(DEVTOOLS_MARKER)
    expect(lazy).toContain(QUERY_DEVTOOLS_MARKER)
  })
})
