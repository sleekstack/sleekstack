import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Start } from '@sleekstack/start'
import { createServer, type Plugin, type ResolvedConfig, type ViteDevServer } from 'vite'
import { devMiddleware } from './dev.js'
import { createStyleSheet } from './highlight.js'
import { assertLinks } from './links.js'
import { frontmatterOf, loadFonts, type OgOptions, renderOgPng } from './og.js'
import { ogImagePath } from './og-meta.js'
import { compileMdx } from './mdx.js'
import type { RenderEntry, prerenderPages } from './prerender.js'
import { type ContentPage, contentRouteTable, scanPages } from './content-routes.js'
import { buildSearchIndex } from './search.js'

export type DocsOptions = {
  /** The content tree: `.md` and `.mdx` pages and the `meta.json` order file. */
  content: string
  /** Prefix for every route, such as `/docs`. */
  base?: string
  /** The dev server entry, relative to the project root: a module exporting `app`, a `start(...)` result. */
  app: string
  /**
   * `vite build` writes one `index.html` per route and the search index. `server` is a module (relative to the project
   * root) exporting `render(path)`, see `RenderEntry`; `client` is the browser entry that hydrates `#app`.
   */
  prerender?: { server: string; client: string }
  /** Write `search-index.json` at build. Default: true. */
  search?: boolean
  /**
   * One 1200 by 630 PNG per page at `og/<name>.png`, from the page's frontmatter `title` and `description`. Pair it with
   * `ogMeta` in the server entry for the tags. Off when absent or `false`. Needs `site` and at least one readable font.
   */
  og?: OgOptions | false
}

const ROUTES = 'virtual:sleek-content'
const CSS = 'virtual:sleek-content.css'
const isPage = (file: string, content: string) => file.startsWith(`${content}/`) && /\.mdx?$/.test(file)

/**
 * Serves a content tree through `start` in dev and checks it at build. `virtual:sleek-content` exports `routes` (the
 * `@sleekstack/router` table) and `pages` (route name to a loader of the compiled page); `virtual:sleek-content.css` is
 * the highlighting stylesheet. A file added, renamed or removed updates both without a restart; a content error shows
 * in the overlay and clears on the next good save. A broken internal link fails the build.
 */
export const sleekContent = (options: DocsOptions): Plugin => {
  const content = resolve(options.content)
  const styles = createStyleSheet()
  let config: ResolvedConfig | undefined
  let root = process.cwd()
  let entryChunk: { script: string; styles: string[] } | undefined
  const pages = (): ContentPage[] => scanPages(content, options)

  const reload = (server: ViteDevServer) => {
    for (const id of [ROUTES, CSS]) {
      const mod = server.moduleGraph.getModuleById(`\0${id}`)
      if (mod) server.moduleGraph.invalidateModule(mod)
    }
    server.ws.send({ type: 'full-reload' })
  }

  const check = async (server: ViteDevServer, file: string) => {
    try {
      await compileMdx(readFileSync(file, 'utf8'), { file, styles })
      assertLinks(pages(), content)
    } catch (e) {
      server.ws.send({ type: 'error', err: { message: (e as Error).message, stack: '', plugin: 'sleek-content' } })
      return
    }
    reload(server)
  }

  return {
    name: 'sleek-content',
    config: (user, env) =>
      options.prerender && env.command === 'build' && !env.isSsrBuild
        ? { build: { rollupOptions: { input: resolve(user.root ?? process.cwd(), options.prerender.client) } } }
        : undefined,
    configResolved: (resolved) => {
      config = resolved
      root = resolved.root
    },
    generateBundle(_, bundle) {
      const chunk = Object.values(bundle).find((c) => c.type === 'chunk' && c.isEntry)
      if (chunk?.type === 'chunk')
        entryChunk = { script: chunk.fileName, styles: [...(chunk.viteMetadata?.importedCss ?? [])] }
    },
    async writeBundle() {
      const { prerender } = options
      if (!prerender || !config || config.command !== 'build' || config.build.ssr) return
      if (!entryChunk) this.error('prerender: the client build produced no entry chunk')
      const outDir = resolve(config.root, config.build.outDir)
      const all = pages()
      // Compiling every page fills the stylesheet; it is written last.
      for (const p of all)
        await compileMdx(readFileSync(p.file, 'utf8'), { file: p.file, styles }).catch((e: Error) => {
          throw new Error(`prerender ${p.path}: ${e.message}`, { cause: e })
        })
      const server = await createServer({
        root: config.root,
        configFile: config.configFile ?? false,
        mode: config.mode,
        logLevel: 'silent',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false, watch: null },
      })
      try {
        const render = (await server.ssrLoadModule(resolve(root, prerender.server))).render as RenderEntry | undefined
        if (typeof render !== 'function') throw new Error(`${prerender.server} must export \`render(path)\``)
        // Rendering runs in the server's module graph: ui's dist is bundler-resolved ESM that plain Node cannot load.
        const here = fileURLToPath(import.meta.url)
        const mod = await server.ssrLoadModule(resolve(dirname(here), `prerender${extname(here)}`))
        await (mod.prerenderPages as typeof prerenderPages)(all, render, outDir, {
          base: config.base,
          script: entryChunk.script,
          styles: ['assets/sleek-content.css', ...entryChunk.styles],
        })
      } finally {
        await server.close()
      }
      if (options.og) {
        const { site, fonts } = options.og
        if (!site) this.error('og: `site` (the origin the site is served from) is required for an absolute og:image')
        const loaded = loadFonts(fonts, config.root)
        for (const p of all) {
          const meta = frontmatterOf(readFileSync(p.file, 'utf8'))
          const png = await renderOgPng({ title: meta.title ?? p.name, description: meta.description }, loaded)
          const file = resolve(outDir, ogImagePath(p.name).slice(1))
          mkdirSync(dirname(file), { recursive: true })
          writeFileSync(file, png)
        }
      }
      if (options.search !== false) {
        const json = JSON.stringify(buildSearchIndex(all))
        writeFileSync(resolve(outDir, 'search-index.json'), json)
        config.logger.info(`search index: ${all.length} pages, ${(json.length / 1024).toFixed(1)} kB`)
      }
      const css = resolve(outDir, 'assets/sleek-content.css')
      mkdirSync(dirname(css), { recursive: true })
      writeFileSync(css, styles.css())
    },
    buildStart() {
      try {
        assertLinks(pages(), content)
      } catch (e) {
        this.error((e as Error).message)
      }
    },
    resolveId: (id) => (id === ROUTES || id === CSS ? `\0${id}` : undefined),
    load(id) {
      if (id === `\0${CSS}`) return styles.css()
      if (id !== `\0${ROUTES}`) return undefined
      const all = pages()
      const loaders = all.map((p) => `${JSON.stringify(p.name)}: () => import(${JSON.stringify(p.file)})`)
      return `export const routes = ${JSON.stringify(contentRouteTable(all))}\nexport const pages = {\n${loaders.join(',\n')}\n}\n`
    },
    async transform(code, id) {
      const file = id.split('?')[0]!
      if (!isPage(file, content)) return undefined
      try {
        return { code: await compileMdx(code, { file, styles }), map: null }
      } catch (e) {
        const route = pages().find((p) => p.file === file)?.path
        throw route ? new Error(`${route}: ${(e as Error).message}`, { cause: e }) : e
      }
    },
    configureServer(server) {
      const load = async () => (await server.ssrLoadModule(resolve(root, options.app))).app as Start
      const accepts = (pathname: string) =>
        pathname.startsWith('/_sleek/') || pages().some((p) => p.path === (pathname.replace(/(.)\/$/, '$1') || '/'))
      server.middlewares.use(devMiddleware(load, accepts))
      server.watcher.add(content)
      server.watcher.on('change', (file) => {
        if (isPage(file, content)) void check(server, file)
        else if (file === resolve(content, 'meta.json')) reload(server)
      })
      for (const event of ['add', 'unlink'] as const)
        server.watcher.on(
          event,
          (file) => (isPage(file, content) || file === resolve(content, 'meta.json')) && reload(server),
        )
    },
  }
}
