import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { match } from '@sleekstack/router'
import type { Start } from '@sleekstack/start'
import type { Plugin, ViteDevServer } from 'vite'
import { devMiddleware } from './dev.js'
import { createStyleSheet } from './highlight.js'
import { assertLinks } from './links.js'
import { compileMdx } from './mdx.js'
import { type Page, routeTable, scanPages } from './routes.js'

export type DocsOptions = {
  /** The content tree: `.md` and `.mdx` pages and the `meta.json` order file. */
  content: string
  /** Prefix for every route, such as `/docs`. */
  base?: string
  /** The dev server entry, relative to the project root: a module exporting `app`, a `start(...)` result. */
  app: string
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
  let root = process.cwd()
  const pages = (): Page[] => scanPages(content, options)

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
    configResolved: (config) => {
      root = config.root
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
      return `export const routes = ${JSON.stringify(routeTable(all))}\nexport const pages = {\n${loaders.join(',\n')}\n}\n`
    },
    async transform(code, id) {
      const file = id.split('?')[0]!
      if (!isPage(file, content)) return undefined
      return { code: await compileMdx(code, { file, styles }), map: null }
    },
    configureServer(server) {
      const load = async () => (await server.ssrLoadModule(resolve(root, options.app))).app as Start
      const accepts = (pathname: string) =>
        pathname.startsWith('/_sleek/') || match(routeTable(pages()), pathname)._tag === 'Some'
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
