import * as path from 'node:path'
import type { AnalyzeError } from '@sleekstack/analyze'
import type { ErrorPayload, Plugin, ViteDevServer } from 'vite'

/**
 * Runs the whole-program analysis of the tsconfig project at `project`, whose server directory is `serverDir` (relative
 * to the project's directory; default `server`); returns its diagnostics (files relative to the project's directory).
 */
export type Analyzer = (
  project: string,
  serverDir?: string,
) => readonly AnalyzeError[] | Promise<readonly AnalyzeError[]>

const DEBOUNCE_MS = 200
const SOURCE = /\.[cm]?[jt]sx?$/

/**
 * `@sleekstack/analyze` (graph, component and Server Service passes), loaded on first use through jiti: the analyzer
 * ships as TypeScript source, which Node cannot import from this package's compiled output.
 */
const sleekstackAnalyzer: Analyzer = async (project, serverDir) => {
  const { createJiti } = await import('jiti')
  const { analyze, analyzeComponents, analyzeServerServices } = await createJiti(import.meta.url).import<
    typeof import('@sleekstack/analyze')
  >('@sleekstack/analyze')
  const report = analyze({ project })
  const all = [
    ...report.extraction,
    ...report.runtimes.flatMap((r) => r.errors),
    ...analyzeComponents({ project }).errors,
    ...analyzeServerServices({ project, serverDir }).errors,
  ]
  // Roots sharing a module repeat its errors.
  return [...new Map(all.map((e) => [`${e.file}:${e.line}:${e.code}:${e.message}`, e])).values()]
}

const describe = (errors: readonly AnalyzeError[]): string =>
  errors
    .map((e) => `${e.file}:${e.line} ${e.code}: ${e.message}${e.fix.map((f) => `\n  fix: ${f}`).join('')}`)
    .join('\n')

const crashMessage = (cause: unknown): string =>
  `sleekstack analyzer crashed: ${cause instanceof Error ? (cause.stack ?? cause.message) : String(cause)}`

/** The overlay error of `errors[0]`, listing every error in its message. */
const overlayError = (errors: readonly AnalyzeError[]) => {
  const { file, line, column = 1 } = errors[0]!
  return { message: describe(errors), stack: '', id: file, plugin: 'sleekstack:analyze', loc: { file, line, column } }
}

/**
 * Runs the analyzer over the Vite root's `tsconfig.json`: always on build, where an analyzer error fails the build,
 * and debounced on every source change in dev, where errors show in the error overlay (file:line of the first) and
 * clear once a run comes back clean. A crashing analyzer is logged (and shown in dev), never thrown. `serverDir` is the
 * server directory relative to the Vite root, as `ServerServicesOptions.serverDir`.
 */
export const analyze = (run: Analyzer = sleekstackAnalyzer, serverDir?: string): Plugin => {
  let project = ''
  let built: Promise<readonly AnalyzeError[] | Error> | undefined
  const attempt = async (): Promise<readonly AnalyzeError[] | Error> => {
    try {
      // Analyzer files are relative to the project's directory; the overlay and Rolldown want absolute ones.
      return (await run(project, serverDir)).map((e) => ({ ...e, file: path.resolve(path.dirname(project), e.file) }))
    } catch (cause) {
      return new Error(crashMessage(cause))
    }
  }
  return {
    name: 'sleekstack:analyze',
    // One run for every environment of a build; a new build (or a watch rebuild) analyzes afresh.
    sharedDuringBuild: true,
    configResolved(config) {
      project = path.join(config.root, 'tsconfig.json')
      built = undefined
    },
    watchChange() {
      built = undefined
    },
    async buildStart() {
      if (this.environment.mode !== 'build') return
      const result = await (built ??= attempt())
      if (result instanceof Error) this.warn(result.message)
      else if (result.length) {
        const { message, id, loc } = overlayError(result)
        this.error({ message: `sleekstack analyzer found ${result.length} error(s):\n${message}`, id, loc })
      }
    },
    configureServer(server) {
      watch(server, attempt)
    },
  }
}

/** Re-analyzes on each (debounced) source change and mirrors the result into the overlay. */
const watch = (server: ViteDevServer, attempt: () => Promise<readonly AnalyzeError[] | Error>) => {
  let shown: ErrorPayload['err'] | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let latest = 0
  // ponytail: the analyzer is synchronous whole-program TypeScript, so a run blocks the dev server for its duration;
  // move it to a worker if large projects stall requests.
  const refresh = async () => {
    const run = ++latest
    const result = await attempt()
    if (run !== latest) return
    if (result instanceof Error) server.config.logger.error(result.message)
    const next =
      result instanceof Error
        ? { message: result.message, stack: '', plugin: 'sleekstack:analyze' }
        : result.length
          ? overlayError(result)
          : undefined
    // Vite buffers an error sent with no browser connected and replays it to the next one, even once fixed; the
    // connection handler below replays the current one instead.
    if (server.ws.clients.size) {
      if (next) server.ws.send({ type: 'error', err: next })
      // An empty update closes the overlay (or reloads a page that opened on it).
      else if (shown) server.ws.send({ type: 'update', updates: [] })
    }
    shown = next
  }
  const schedule = (file: string) => {
    if (!SOURCE.test(file) || file.includes(`${path.sep}node_modules${path.sep}`)) return
    clearTimeout(timer)
    timer = setTimeout(() => void refresh(), DEBOUNCE_MS)
  }
  server.watcher.on('add', schedule).on('change', schedule).on('unlink', schedule)
  server.ws.on('connection', () => {
    if (shown) server.ws.send({ type: 'error', err: shown })
  })
  server.httpServer?.once('close', () => clearTimeout(timer))
  void refresh()
}
