/**
 * R2/R4: core, query and ui packed as tarballs install into a fresh bundler-style project,
 * typecheck a JSX component, and run `mount`, `renderToString` and `./query` under jsdom.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const packages = fileURLToPath(new URL('../../..', import.meta.url))
const ui = JSON.parse(readFileSync(path.join(packages, 'ui/package.json'), 'utf8'))
const dir = mkdtempSync(path.join(tmpdir(), 'sleekstack-pack-'))
const run = (cmd: string, args: string[], cwd: string) => {
  try {
    return execFileSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8', timeout: 120_000 })
  } catch (e) {
    const { stdout, stderr } = e as { stdout?: string; stderr?: string }
    throw new Error(`${cmd} ${args.join(' ')} failed:\n${stdout}\n${stderr}`)
  }
}
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const tgz: Record<string, string> = {}
const manifest = (name: string) => JSON.parse(run('tar', ['-xzOf', tgz[name]!, 'package/package.json'], dir))

const APP = `/** @jsxImportSource @sleekstack/ui */
import { Effect, Layer } from 'effect'
import { fromReact, mount, renderToString } from '@sleekstack/ui'
import { useQuery } from '@sleekstack/ui/query'
import { QueryClientLive } from '@sleekstack/query'
import { Hello } from './guest'

const Card = (props: { name: string }) => <div class="card"><h1>{props.name}</h1></div>
const Guest = fromReact(Hello)
const Answer = () => Effect.flatMap(useQuery({ queryKey: ['a'], queryFn: async () => 42 }), (r) => <b>{r.status}:{String(r.data ?? '')}</b>)

export const ssr = await renderToString(<main><Card name="Ada" /><Guest who="Bo" /></main>, { layer: Layer.empty })
const container = document.createElement('div')
await mount(<section><Card name="Cy" /><Answer /></section>, { layer: QueryClientLive(), container })
for (let i = 0; i < 100 && !container.textContent!.includes('success'); i++) await new Promise((r) => setTimeout(r, 10))
export const dom = container.innerHTML
`
const GUEST = `import { createElement } from 'react'
export const Hello = ({ who }: { who: string }) => createElement('i', null, 'hi ' + who)
`
const RUN = `import { JSDOM } from 'jsdom'
const { window } = new JSDOM('')
for (const k of ['window', 'document', 'Node', 'HTMLElement', 'Element', 'Text', 'Comment', 'DocumentFragment', 'MutationObserver']) globalThis[k] = window[k]
const { ssr, dom } = await import('./out.mjs')
console.log(JSON.stringify({ ssr, dom }))
process.exit(0) // the query client and jsdom keep the loop alive
`

describe('tarball consumer (R2, R4)', () => {
  it('packs core, query and ui with no workspace:* and effect as a peer', () => {
    for (const name of ['core', 'query', 'ui']) {
      const cwd = path.join(packages, name)
      run('pnpm', ['run', 'build'], cwd)
      const out = run('pnpm', ['pack', '--pack-destination', dir], cwd).trim().split('\n').pop()!
      tgz[name] = path.resolve(dir, out)
      const m = manifest(name)
      expect(JSON.stringify(m), name).not.toContain('workspace:')
      expect(m.peerDependencies?.effect, name).toBeDefined()
      expect(m.dependencies?.effect, name).toBeUndefined()
    }
  }, 120_000)

  it('installs, typechecks and runs mount, renderToString and ./query in jsdom', () => {
    const app = path.join(dir, 'app')
    run('mkdir', ['-p', path.join(app, 'src')], dir)
    const dev = ui.devDependencies
    writeFileSync(
      path.join(app, 'package.json'),
      JSON.stringify({
        name: 'app',
        private: true,
        type: 'module',
        dependencies: {
          '@sleekstack/ui': `file:${tgz.ui}`,
          '@sleekstack/core': `file:${tgz.core}`,
          '@sleekstack/query': `file:${tgz.query}`,
          effect: dev.effect,
          '@tanstack/query-core': dev['@tanstack/query-core'],
          react: dev.react,
          'react-dom': dev['react-dom'],
        },
        devDependencies: {
          jsdom: dev.jsdom,
          '@types/react': dev['@types/react'],
          typescript: '^5.9.0',
          esbuild: '^0.25.0',
        },
      }),
    )
    // pnpm 11 reads overrides from pnpm-workspace.yaml; packed ui depends on core/query at 0.0.1, which is not on the registry.
    writeFileSync(
      path.join(app, 'pnpm-workspace.yaml'),
      `overrides:\n  "@sleekstack/core": "file:${tgz.core}"\n  "@sleekstack/query": "file:${tgz.query}"\nallowBuilds:\n  esbuild: true\n`,
    )
    writeFileSync(
      path.join(app, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'react-jsx',
          lib: ['ES2022', 'DOM'],
          skipLibCheck: true,
        },
        include: ['src'],
      }),
    )
    writeFileSync(path.join(app, 'src/app.tsx'), APP)
    writeFileSync(path.join(app, 'src/guest.ts'), GUEST)
    writeFileSync(path.join(app, 'run.mjs'), RUN)

    run('pnpm', ['install', '--prefer-offline'], app)
    const effects = readdirSync(path.join(app, 'node_modules/.pnpm')).filter((d) => d.startsWith('effect@'))
    expect(effects).toHaveLength(1)

    run('pnpm', ['exec', 'tsc', '-p', '.'], app)

    // Source maps ship next to the emitted JS and carry their sources.
    const dist = path.join(app, 'node_modules/@sleekstack/ui/dist')
    const js = readFileSync(path.join(dist, 'index.js'), 'utf8')
    const mapFile = js.match(/sourceMappingURL=(\S+)/)?.[1]
    expect(mapFile && existsSync(path.join(dist, mapFile))).toBe(true)
    expect(JSON.parse(readFileSync(path.join(dist, mapFile!), 'utf8')).sourcesContent?.[0]).toBeTruthy()

    run(
      'pnpm',
      [
        'exec',
        'esbuild',
        'src/app.tsx',
        '--bundle',
        '--platform=node',
        '--format=esm',
        '--outfile=out.mjs',
        '--external:jsdom',
        '--external:react',
        '--external:react-dom',
      ],
      app,
    )
    const { ssr, dom } = JSON.parse(run('node', ['run.mjs'], app))
    expect(ssr).toContain('<div class="card"><h1>Ada</h1></div>')
    expect(ssr).toContain('<i>hi Bo</i>')
    expect(dom).toContain('<h1>Cy</h1>')
    expect(dom).toContain('<b>success:42</b>')
  }, 300_000)
})
