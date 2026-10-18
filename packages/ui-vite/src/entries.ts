import type { IncomingMessage, ServerResponse } from 'node:http'
import * as path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { isRunnableDevEnvironment, normalizePath, type Plugin, type Rollup } from 'vite'

/** The app's browser and server entry modules. */
export interface EntriesOptions {
  /**
   * Paths relative to the Vite root. `server`'s default export answers a request:
   * `(request: Request) => Response | Promise<Response>`, e.g. `handle` from `@sleekstack/router` with `stream: true`.
   * With `entries`, `vite build` writes the client bundle to `dist/client` and the server bundle to `dist/server`,
   * and the dev server answers every request the server entry's way.
   */
  readonly entries?: { readonly client: string; readonly server: string }
}

/** Exports `scripts`: the markup that loads the client entry, for the server entry's document head. */
const CLIENT_MODULE = 'virtual:sleekstack/client'
const RESOLVED = `\0${CLIENT_MODULE}`

const script = (src: string) => `<script type="module" src="${src}"></script>`

// The client entry chunk and the CSS it imports, from the client build's output.
const builtScripts = (output: Rollup.RollupOutput, entry: string, base: string): string => {
  const chunk = output.output.find((o): o is Rollup.OutputChunk => o.type === 'chunk' && o.facadeModuleId === entry)
  if (!chunk) throw new Error(`sleekstack: the client build has no chunk for ${entry}`)
  const css = [...(chunk.viteMetadata?.importedCss ?? [])].map((f) => `<link rel="stylesheet" href="${base}${f}">`)
  return css.join('') + script(base + chunk.fileName)
}

const toRequest = (req: IncomingMessage): Request => {
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers))
    for (const value of Array.isArray(v) ? v : v === undefined ? [] : [v]) headers.append(k, value)
  const method = req.method ?? 'GET'
  const body = method === 'GET' || method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream)
  return new Request(new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`), {
    method,
    headers,
    body,
    duplex: 'half',
  } as RequestInit)
}

const send = async (res: ServerResponse, response: Response): Promise<void> => {
  res.statusCode = response.status
  response.headers.forEach((v, k) => k !== 'set-cookie' && res.setHeader(k, v))
  const cookies = response.headers.getSetCookie()
  if (cookies.length > 0) res.setHeader('set-cookie', cookies)
  if (response.body) await pipeline(Readable.fromWeb(response.body as NodeReadableStream), res)
  else res.end()
}

/**
 * Client and SSR entries (R4): sets up the `client` and `ssr` environments so `vite build` builds the client bundle,
 * then the server bundle, whose `virtual:sleekstack/client` points at the built client chunk. In dev, requests go to
 * the server entry run in the `ssr` environment, and `virtual:sleekstack/client` loads the source entry with HMR.
 * Without `entries` it does nothing.
 */
export const entries = (options: EntriesOptions = {}): Plugin => {
  const e = options.entries
  let root = ''
  let base = '/'
  let dev = false
  let scripts: string | undefined
  const abs = (file: string) => normalizePath(path.resolve(root, file))
  return {
    name: 'sleekstack:entries',
    // One instance across the build's environments: the client build's output reaches the server build's module.
    sharedDuringBuild: true,
    config(config) {
      if (!e) return
      const at = (file: string) => path.resolve(config.root ?? '', file)
      // Defaults only: a plugin's config is merged over the user's, so an outDir the user set is kept as is.
      const outDir = (name: string, fallback: string) => config.environments?.[name]?.build?.outDir ?? fallback
      return {
        appType: 'custom',
        builder: {},
        environments: {
          client: { build: { outDir: outDir('client', 'dist/client'), rollupOptions: { input: at(e.client) } } },
          ssr: {
            build: { outDir: outDir('ssr', 'dist/server'), rollupOptions: { input: { server: at(e.server) } } },
          },
        },
      }
    },
    configResolved(config) {
      root = config.root
      base = config.base
      dev = config.command === 'serve'
    },
    buildApp: {
      order: 'pre',
      async handler(builder) {
        if (!e) return
        const { client, ssr } = builder.environments
        const output = await builder.build(client!)
        scripts = builtScripts(output as Rollup.RollupOutput, abs(e.client), base)
        await builder.build(ssr!)
      },
    },
    resolveId: {
      filter: { id: new RegExp(`^${CLIENT_MODULE}$`) },
      handler: () => (e ? RESOLVED : null),
    },
    load: {
      filter: { id: new RegExp(`^\0${CLIENT_MODULE}$`) },
      handler() {
        const html = dev
          ? script(`${base}@vite/client`) + script(base + path.posix.relative(root, abs(e!.client)))
          : scripts
        if (html === undefined)
          throw new Error(`sleekstack: ${CLIENT_MODULE} needs the client build first (vite build)`)
        return `export const scripts = ${JSON.stringify(html)}\n`
      },
    },
    configureServer(server) {
      if (!e) return
      // After Vite's own middlewares: modules and static files are served first.
      return () => {
        server.middlewares.use(async (req, res, next) => {
          try {
            const ssr = server.environments.ssr
            if (!ssr || !isRunnableDevEnvironment(ssr))
              throw new Error('sleekstack: the ssr environment cannot run modules')
            const mod = (await ssr.runner.import(abs(e.server))) as {
              default: (r: Request) => Response | Promise<Response>
            }
            await send(res, await mod.default(toRequest(req)))
          } catch (error) {
            next(error)
          }
        })
      }
    },
  }
}
