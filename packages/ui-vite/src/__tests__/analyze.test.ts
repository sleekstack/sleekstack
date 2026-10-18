import { fileURLToPath } from 'node:url'
import { build, createLogger, createServer, type ViteDevServer } from 'vite'
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

/** A dev server on the fake analyzer, with its overlay messages and logged errors. */
const serve = async (run: Analyzer) => {
  const logged: string[] = []
  const sent = vi.fn()
  const logger = { ...createLogger('silent'), error: (msg: string) => void logged.push(msg) }
  server = await createServer({
    root,
    configFile: false,
    customLogger: logger,
    // Records overlay messages from before the analyzer plugin's first (initial) run.
    plugins: [
      { name: 'record', configureServer: (s) => void vi.spyOn(s.ws, 'send').mockImplementation(sent) },
      analyze(run),
    ],
    server: { middlewareMode: true, hmr: false, watch: null },
  })
  return { server, sent, logged }
}

const bundle = (run: Analyzer, warn = vi.fn()) =>
  build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [analyze(run)],
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
})

describe('analyze() in build', () => {
  it('fails the build on an analyzer error, naming file:line', async () => {
    await expect(bundle(() => [missing])).rejects.toThrow(`${root}/src/app.ts:7 MissingDependency`)
  })

  it('reports an analyzer crash as a warning and still builds', async () => {
    const warn = vi.fn()
    await expect(bundle(crash, warn)).resolves.toBeDefined()
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('checker exploded') }),
      expect.anything(),
    )
  })
})
