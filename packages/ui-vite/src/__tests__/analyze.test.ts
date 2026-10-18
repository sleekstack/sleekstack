import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, createLogger, createServer, type Plugin, type Rolldown, type ViteDevServer } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnalyzeError } from '@sleekstack/analyze'
import { analyze, type Analyzer } from '../analyze.js'

const root = fileURLToPath(new URL('./fixtures/analyze', import.meta.url))
const missing: AnalyzeError = {
  file: 'src/app.ts',
  line: 7,
  column: 3,
  code: 'MissingDependency',
  message: 'Service "B" requires "A", but no entry provides it.',
  fix: ['Provide the Tag'],
  docs: '/docs/errors#graph-errors',
}
const crash: Analyzer = () => {
  throw new Error('checker exploded')
}

let server: ViteDevServer | undefined
afterEach(() => server?.close())

/**
 * A dev server on the fake analyzer, with its overlay messages, logged errors and a `connect()` that opens a browser.
 * The `record` plugin runs before the analyzer's first (initial) run.
 */
const serve = async (run: Analyzer, { connected = true } = {}) => {
  const logged: string[] = []
  const sent = vi.fn()
  const clients = new Set<unknown>(connected ? [{}] : [])
  let onConnection = () => {}
  const record: Plugin = {
    name: 'record',
    configureServer(s) {
      Object.defineProperty(s.ws, 'clients', { get: () => clients })
      vi.spyOn(s.ws, 'send').mockImplementation(sent)
      vi.spyOn(s.ws, 'on').mockImplementation(((event: string, cb: () => void) => {
        if (event === 'connection') onConnection = cb
        return s.ws
      }) as never)
    },
  }
  server = await createServer({
    root,
    configFile: false,
    customLogger: { ...createLogger('silent'), error: (msg: string) => void logged.push(msg) },
    plugins: [record, analyze(run)],
    server: { middlewareMode: true, hmr: false, watch: null },
  })
  const connect = () => (clients.add({}), onConnection())
  return { server, sent, logged, connect }
}

const bundle = (plugin: Plugin, warn = vi.fn()) =>
  build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [plugin],
    build: { write: false, rollupOptions: { input: `${root}/main.ts`, onwarn: warn } },
  })

describe('analyze() in dev', () => {
  it('shows an analyzer error in the overlay with file:line and clears it once fixed', async () => {
    let errors: readonly AnalyzeError[] = [missing]
    const { server, sent } = await serve(() => errors)
    await vi.waitFor(() =>
      expect(sent).toHaveBeenCalledWith({
        type: 'error',
        err: expect.objectContaining({
          loc: { file: `${root}/src/app.ts`, line: 7, column: 3 },
          message: expect.stringContaining(`${root}/src/app.ts:7 MissingDependency`),
        }),
      }),
    )
    errors = []
    server.watcher.emit('change', `${root}/src/app.ts`)
    await vi.waitFor(() => expect(sent).toHaveBeenLastCalledWith({ type: 'update', updates: [] }))
  })

  it('reports an analyzer crash in the overlay and log without throwing', async () => {
    const { sent, logged } = await serve(crash)
    await vi.waitFor(() =>
      expect(sent).toHaveBeenCalledWith({
        type: 'error',
        err: expect.objectContaining({ message: expect.stringContaining('analyzer crashed: Error: checker exploded') }),
      }),
    )
    expect(logged.join('\n')).toContain('checker exploded')
  })

  it('gives a browser that connects after the fix no stale error', async () => {
    let errors: readonly AnalyzeError[] = [missing]
    const run = vi.fn(() => errors)
    const { server, sent, connect } = await serve(run, { connected: false })
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    errors = []
    server.watcher.emit('change', `${root}/src/app.ts`)
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2))
    await Promise.resolve()
    connect()
    expect(sent).not.toHaveBeenCalled()
  })
})

describe('analyze() in build', () => {
  it('fails the build on an analyzer error, naming file:line', async () => {
    await expect(bundle(analyze(() => [missing]))).rejects.toThrow(`${root}/src/app.ts:7 MissingDependency`)
  })

  it('analyzes each build afresh, including watch rebuilds', async () => {
    let errors: readonly AnalyzeError[] = []
    const plugin = analyze(() => errors)
    await expect(bundle(plugin)).resolves.toBeDefined()
    errors = [missing]
    await expect(bundle(plugin)).rejects.toThrow('MissingDependency')

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-vite-analyze-'))
    fs.writeFileSync(path.join(dir, 'main.ts'), 'export const answer = 42\n')
    errors = []
    const watcher = (await build({
      root: dir,
      configFile: false,
      logLevel: 'silent',
      plugins: [plugin],
      build: { write: false, watch: {}, rollupOptions: { input: path.join(dir, 'main.ts') } },
    })) as Rolldown.RolldownWatcher
    const outcomes: string[] = []
    watcher.on('event', (e) => {
      if (e.code === 'BUNDLE_END' || e.code === 'ERROR') outcomes.push(e.code)
      if (e.code === 'BUNDLE_END') void e.result.close()
    })
    try {
      // Counts vary: macOS may report the fixture's creation late, as an extra clean rebuild.
      await vi.waitFor(() => expect(outcomes).toContain('BUNDLE_END'))
      errors = [missing]
      fs.writeFileSync(path.join(dir, 'main.ts'), 'export const answer = 43\n')
      await vi.waitFor(() => expect(outcomes).toContain('ERROR'))
      expect(outcomes[0]).toBe('BUNDLE_END')
    } finally {
      await watcher.close()
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports an analyzer crash as a warning and still builds', async () => {
    const warn = vi.fn()
    await expect(bundle(analyze(crash), warn)).resolves.toBeDefined()
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('checker exploded') }),
      expect.anything(),
    )
  })
})
