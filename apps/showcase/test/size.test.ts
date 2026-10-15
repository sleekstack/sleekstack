import { readFileSync } from 'node:fs'
import * as path from 'node:path'
import { gzipSync } from 'node:zlib'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

const pkg = (p: string) => path.join(__dirname, '../../../packages', p)
// Resolve the workspace packages to their TypeScript source instead of the built dist.
const sourceAlias = [
  { find: /^@sleekstack\/ui$/, replacement: pkg('ui/src/index.ts') },
  { find: /^@sleekstack\/ui\/(.*)$/, replacement: pkg('ui/src/$1.ts') },
  { find: /^@sleekstack\/core$/, replacement: pkg('core/src/index.ts') },
  { find: /^@sleekstack\/query$/, replacement: pkg('query/src/index.ts') },
]

/** ADR 0017's method: production lib build, minified; eager = entry plus its static imports, gzipped. */
const measure = async (entry: string, source = false) => {
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    resolve: source ? { alias: sourceAlias } : {},
    // An app build replaces NODE_ENV; lib mode does not, and React would bundle its dev build too.
    define: { 'process.env.NODE_ENV': '"production"' },
    build: { write: false, minify: true, lib: { entry: path.join(__dirname, '../src', entry), formats: ['es'] } },
  })
  const chunks = (Array.isArray(out) ? out : [out])
    .flatMap((o) => ('output' in o ? o.output : []))
    .filter((c) => c.type === 'chunk')
  const main = chunks.find((c) => c.isEntry)!
  const eager = [main, ...main.imports.map((f) => chunks.find((c) => c.fileName === f)!)].map((c) => c.code).join('\n')
  const lazy = chunks
    .filter((c) => c !== main && !main.imports.includes(c.fileName))
    .map((c) => c.code)
    .join('\n')
  return {
    code: chunks.map((c) => c.code).join('\n'),
    eager,
    lazy,
    min: Buffer.byteLength(eager),
    gz: gzipSync(eager).length,
    lazyGz: lazy ? gzipSync(lazy).length : 0,
  }
}

// Gzip limits on the built packages: the ADR 0022 measurement plus about 5%.
const budgets = [
  { name: 'mount hello-world', entry: 'size/mount.tsx', limit: 203_000 },
  { name: 'hydrating app', entry: 'size/hydrate.tsx', limit: 225_000 },
  { name: 'resume', entry: 'resume/entry.ts', limit: 83_000 },
  { name: 'lazy mount', entry: 'size/lazy.tsx', limit: 209_000 },
]

describe('size budget (ADR 0022)', () => {
  for (const { name, entry, limit } of budgets)
    it(`${name} stays within ${limit} B gzip`, { timeout: 60_000 }, async () => {
      const dist = await measure(entry)
      const src = await measure(entry, true)
      console.log(
        `${name}: dist ${dist.min} B min, ${dist.gz} B gzip (lazy ${dist.lazyGz} B); source ${src.min} B min, ${src.gz} B gzip`,
      )
      expect(dist.gz).toBeLessThanOrEqual(limit)
    })

  it('a lazy component lands in its own chunk', { timeout: 60_000 }, async () => {
    const { eager, lazy, lazyGz } = await measure('size/lazy.tsx')
    expect(lazyGz).toBeGreaterThan(0)
    expect(lazy).toContain('heavy-lazy-chunk-marker')
    expect(eager).not.toContain('heavy-lazy-chunk-marker')
  })

  it('a mount-only bundle tree-shakes resume and query', { timeout: 60_000 }, async () => {
    const { code } = await measure('size/mount.tsx')
    expect(code).not.toContain('ManifestDecodeFailed')
    expect(code).not.toContain('QueryFailed')
    // The tags do survive minification where they are used.
    expect((await measure('resume/entry.ts')).code).toContain('ManifestDecodeFailed')
    expect(readFileSync(pkg('query/dist/ui.js'), 'utf8')).toContain('QueryFailed')
  })

  it('ui has no dependency on the router', () => {
    const { dependencies = {}, peerDependencies = {} } = JSON.parse(readFileSync(pkg('ui/package.json'), 'utf8'))
    expect(Object.keys({ ...dependencies, ...peerDependencies })).not.toContain('@sleekstack/router')
  })
})
