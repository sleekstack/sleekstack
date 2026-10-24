import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { gzipSync } from 'node:zlib'
import { serverServices } from '@sleekstack/ui-vite'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

const pkg = (p: string) => path.join(__dirname, '../../../packages', p)
// Resolve the workspace packages to their TypeScript source instead of the built dist.
const sourceAlias = [
  { find: /^@sleekstack\/ui$/, replacement: pkg('ui/src/index.ts') },
  { find: /^@sleekstack\/ui\/(.*)$/, replacement: pkg('ui/src/$1.ts') },
  { find: /^@sleekstack\/core$/, replacement: pkg('core/src/index.ts') },
  { find: /^@sleekstack\/model$/, replacement: pkg('model/src/index.ts') },
  { find: /^@sleekstack\/model\/(.*)$/, replacement: pkg('model/src/$1.ts') },
  { find: /^@sleekstack\/query$/, replacement: pkg('query/src/index.ts') },
  { find: /^@sleekstack\/start$/, replacement: pkg('start/src/index.ts') },
  { find: /^@sleekstack\/start\/(.*)$/, replacement: pkg('start/src/$1.ts') },
]

const root = path.join(__dirname, '..')

/**
 * ADR 0017's method: production lib build, minified; eager = entry plus its static imports, gzipped. An entry that
 * reaches the generated Server Service modules needs `serverServices`: `services` adds it, for the browser (`client`)
 * or as the server build (`ssr`, everything bundled).
 */
const measure = async (entry: string, source = false, services?: 'client' | 'ssr') => {
  const out = await build({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: services ? [serverServices()] : [],
    ...(services === 'ssr' && { ssr: { noExternal: true } }),
    resolve: source ? { alias: sourceAlias } : {},
    // An app build replaces NODE_ENV; lib mode does not, and React would bundle its dev build too.
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      write: false,
      minify: true,
      ssr: services === 'ssr',
      lib: { entry: path.resolve(__dirname, '../src', entry), formats: ['es'] },
    },
  })
  const chunks = (Array.isArray(out) ? out : [out])
    .flatMap((o) => ('output' in o ? o.output : []))
    .filter((c) => c.type === 'chunk')
  const main = chunks.find((c) => c.isEntry)!
  // An import with no chunk is external (a server build's Node built-ins).
  const eager = [main, ...main.imports.flatMap((f) => chunks.find((c) => c.fileName === f) ?? [])]
    .map((c) => c.code)
    .join('\n')
  const lazy = chunks
    .filter((c) => c !== main && !main.imports.includes(c.fileName))
    .map((c) => c.code)
    .join('\n')
  return {
    code: chunks.map((c) => c.code).join('\n'),
    modules: chunks.flatMap((c) => c.moduleIds),
    eager,
    lazy,
    min: Buffer.byteLength(eager),
    gz: gzipSync(eager).length,
    lazyGz: lazy ? gzipSync(lazy).length : 0,
  }
}

// Gzip limits on the built packages: the ADR 0022 measurement plus about 5%.
const budgets: ReadonlyArray<{ name: string; entry: string; limit: number }> = [
  { name: 'mount hello-world', entry: 'size/mount.tsx', limit: 203_000 },
  { name: 'hydrating app', entry: 'size/hydrate.tsx', limit: 225_000 },
  { name: 'resume', entry: 'resume/entry.ts', limit: 83_000 },
  { name: 'lazy mount', entry: 'size/lazy.tsx', limit: 209_000 },
  { name: 'mount with a Draft', entry: 'size/model.tsx', limit: 231_000 },
  { name: 'mount with a record', entry: 'size/records.tsx', limit: 233_000 },
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

  it(
    'the client chunk holds the server function contract, no server module and no server Layer graph',
    { timeout: 60_000 },
    async () => {
      // Strings only the server side holds: the `Items` Tag key (server/app.ts and its Layer), the tally count's Tag key
      // (server/tally.layer.ts), start's origin check (origin.ts, beside the endpoint in wire.ts) and its function
      // registry and cookie jar.
      const serverOnly = [
        'showcase/server/Items',
        'showcase/server/TallyCount',
        'sec-fetch-site',
        'DuplicateServerFn',
        'InvalidCookie',
      ]
      const server = await measure('../server/app.ts', true, 'ssr')
      for (const marker of serverOnly) expect(server.code).toContain(marker)
      for (const file of ['/server/routes/api/tally.controller.ts', '/server/tally.layer.ts', '/server/rpc.ts'])
        expect(
          server.modules.some((id) => id.endsWith(file)),
          file,
        ).toBe(true)
      for (const source of [false, true]) {
        const { code, modules } = await measure('main.tsx', source, 'client')
        expect(code).toContain('items.add') // the page and its stub are in the client
        expect(code).toContain('"Tally"') // the Server Service's generated client, keyed by its Tag id
        expect(modules.some((id) => id.includes('virtual:sleek/rpc'))).toBe(true) // the generated Tag the page imports
        for (const marker of serverOnly) expect(code, `${marker} (source: ${source})`).not.toContain(marker)
        // No implementation and no server Layer: nothing under server/, no `*.server.ts`.
        expect(modules.filter((id) => /\.server\.[cm]?[jt]sx?$|\/showcase\/server\//.test(id))).toEqual([])
      }
    },
  )

  it('a client entry importing a Layer File fails the build, naming the chain', { timeout: 60_000 }, async () => {
    const entry = path.join(mkdtempSync(path.join(tmpdir(), 'showcase-')), 'entry.ts')
    writeFileSync(
      entry,
      `import TallyCountLive from ${JSON.stringify(path.join(root, 'server/tally.layer.ts'))}\nconsole.log(TallyCountLive)\n`,
    )
    await expect(measure(entry, false, 'client')).rejects.toThrow(
      /"server\/tally\.layer\.ts" is in the browser build: .*entry\.ts -> server\/tally\.layer\.ts/,
    )
  })

  it(
    'a mount-only bundle carries no Draft code; a Draft brings it from @sleekstack/model',
    { timeout: 60_000 },
    async () => {
      // `useDraft` survives minification as the name in its missing-store error.
      expect((await measure('size/mount.tsx')).code).not.toContain('useDraft')
      expect((await measure('size/model.tsx')).code).toContain('useDraft')
    },
  )

  it('ui has no dependency on the router', () => {
    const { dependencies = {}, peerDependencies = {} } = JSON.parse(readFileSync(pkg('ui/package.json'), 'utf8'))
    expect(Object.keys({ ...dependencies, ...peerDependencies })).not.toContain('@sleekstack/router')
  })
})
