import { mkdir, writeFile } from 'node:fs/promises'
import * as path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Cause } from 'effect'
import type { Plugin } from 'vite'
import { enumerate, type PrerenderOption, type PrerenderRoutes } from './enumerate.js'

/**
 * What prerendering reads from the built server entry: its routes as `router`, and its request handler, called with an
 * `onError` for `handle`, which gets the render errors a streamed page reports after its 200.
 */
interface ServerEntry {
  readonly default: (
    request: Request,
    context: { readonly onError: (cause: unknown) => void },
  ) => Response | Promise<Response>
  readonly router?: PrerenderRoutes
}

const messageOf = (cause: unknown) => {
  const e = Cause.isCause(cause) ? Cause.squash(cause) : cause
  return e instanceof Error ? e.message : String(e)
}

/**
 * The file of `pathname` inside `outDir`, each segment decoded (`/a%20b` is `a b/index.html`). Throws for a segment that
 * decodes to a separator or to `.` / `..`, which would write another path's file.
 */
const fileOf = (outDir: string, pathname: string) => {
  const parts = pathname
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s))
  const bad = parts.find((s) => /[/\\]/.test(s) || s === '.' || s === '..')
  if (bad !== undefined) throw new Error(`segment '${bad}' does not map to a file`)
  return path.join(outDir, ...parts, 'index.html')
}

/**
 * Requests every enumerated path from the built server entry and writes its HTML to `<outDir><path>/index.html`. A
 * path that throws, answers other than 200 or reports to `onError` rejects naming it.
 */
const prerenderBuilt = async (
  serverFile: string,
  outDir: string,
  option: PrerenderOption,
  warn: (message: string) => void,
): Promise<readonly string[]> => {
  const server = (await import(pathToFileURL(serverFile).href)) as ServerEntry
  if (!server.router) throw new Error('sleekstack: `prerender` needs the server entry to export its router as `router`')
  const { paths, warnings } = await enumerate(server.router, option)
  warnings.forEach(warn)
  const requested = new Set<string>()
  const written = new Map<string, string>()
  for (const p of paths) {
    const url = new URL(p, 'http://localhost')
    // `/a b` and `/a%20b` are one page.
    if (requested.has(url.pathname)) continue
    requested.add(url.pathname)
    let html: string
    let file: string
    try {
      file = fileOf(outDir, url.pathname)
      const other = written.get(file)
      if (other !== undefined) throw new Error(`writes the same file as ${other}`)
      written.set(file, p)
      const errors: unknown[] = []
      const response = await server.default(new Request(url), { onError: (cause) => errors.push(cause) })
      html = await response.text()
      if (errors.length > 0) throw new Error(messageOf(errors[0]), { cause: errors[0] })
      if (response.status !== 200) throw new Error(`status ${response.status}`)
    } catch (e) {
      throw new Error(`prerender: route ${p} failed: ${(e as Error).message}`, { cause: e })
    }
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, html)
  }
  return paths
}

/**
 * Prerendering (`prerender` with `entries`): after the client and server builds, renders each enumerated path through
 * the built server entry, the SSR path itself (loaders, hydration payload, document head), into the client output.
 */
export const prerender = (option: PrerenderOption | undefined, server: string | undefined): Plugin => {
  let entry = ''
  let serverFile: string | undefined
  return {
    name: 'sleekstack:prerender',
    sharedDuringBuild: true,
    configResolved(config) {
      if (option && !server) throw new Error('sleekstack: `prerender` needs `entries`')
      entry = server ? path.resolve(config.root, server) : ''
    },
    writeBundle(output, bundle) {
      if (!option || this.environment.name !== 'ssr') return
      for (const c of Object.values(bundle))
        if (c.type === 'chunk' && c.facadeModuleId && path.resolve(c.facadeModuleId) === entry)
          serverFile = path.resolve(output.dir!, c.fileName)
    },
    buildApp: {
      order: 'post',
      async handler(builder) {
        if (!option) return
        if (!serverFile) throw new Error('sleekstack: `prerender` found no built server entry')
        const client = builder.environments.client!.config
        const paths = await prerenderBuilt(serverFile, path.resolve(client.root, client.build.outDir), option, (m) =>
          builder.config.logger.warn(m),
        )
        builder.config.logger.info(`sleekstack: prerendered ${paths.length} page(s)`)
      },
    },
  }
}
