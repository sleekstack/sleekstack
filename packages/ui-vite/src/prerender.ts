import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type Node, renderToString } from '@sleekstack/ui'
import type { Effect, Layer } from 'effect'
import type { ContentPage } from './content-routes.js'

/** What a server entry returns for a path: the page to render and the services it needs. */
export type Rendered = { app: Effect.Effect<Node, any, any>; layer: Layer.Layer<any, any, never> }

/** The server entry's `render` export: the route's page for `path`, built the way the app's `start` handler builds it. */
export type RenderEntry = (path: string) => Rendered | Promise<Rendered>

export type Assets = {
  /** URL prefix of the output, ending in `/` (Vite's `base`). */
  base: string
  /** Output-relative files: the client entry chunk and the stylesheets, in link order. */
  script: string
  styles: string[]
}

const shell = (head: string, body: string, a: Assets) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${head}` +
  a.styles.map((s) => `<link rel="stylesheet" href="${a.base}${s}">`).join('') +
  `<script type="module" src="${a.base}${a.script}"></script></head><body><div id="app">${body}</div></body></html>`

/** The HTML file of a route inside the output directory: `/` is `index.html`, `/a/b` is `a/b/index.html`. */
export const fileOf = (outDir: string, path: string) => join(outDir, path, 'index.html')

/** Renders one page into a full document; the head is awaited before the shell is written. */
export const renderDocument = async (entry: RenderEntry, path: string, assets: Assets): Promise<string> => {
  const { app, layer } = await entry(path)
  let head = ''
  const body = await renderToString(app, { layer, onHead: (h: string) => void (head = h) })
  return shell(head, body, assets)
}

/** Writes one `index.html` per page. A page that fails to render fails the build naming its route. */
export const prerenderPages = async (
  pages: readonly ContentPage[],
  entry: RenderEntry,
  outDir: string,
  assets: Assets,
) => {
  for (const page of pages) {
    let html: string
    try {
      html = await renderDocument(entry, page.path, assets)
    } catch (e) {
      throw new Error(`prerender ${page.path}: ${(e as Error).message}`, { cause: e })
    }
    const file = fileOf(outDir, page.path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, html)
  }
}
