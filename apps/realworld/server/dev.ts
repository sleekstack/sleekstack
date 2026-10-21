import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { Start } from '@sleekstack/start'

/** The `index.html` document for `url`, as Vite serves it; the rendered page goes into its `<div id="app">`. */
export type DocumentOf = (url: string) => Promise<string>

const APP = '<div id="app"></div>'
// A replacer function, so a `$&` in the page stays literal.
const inject = (document: string, page: string) => document.replace(APP, () => `<div id="app">${page}</div>`)

/** Server Service calls, the REST facade and page navigations go to `start`; Vite serves modules and assets. */
const forStart = (req: IncomingMessage) =>
  req.url!.startsWith('/_sleek/') ||
  req.url!.startsWith('/api/') ||
  ((req.method === 'GET' || req.method === 'HEAD') && (req.headers.accept ?? '').includes('text/html'))

/**
 * Connect middleware for the Vite dev server: a Server Service call, an `/api/` request or a page navigation goes, as
 * a web `Request`, to the `start` entry that `load` returns; every other request goes on to Vite. An HTML answer (a
 * server-rendered page) is sent inside the document `documentOf` gives.
 */
export const devMiddleware =
  (load: () => Promise<Start>, documentOf: DocumentOf) =>
  (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): void => {
    if (!req.url || !forStart(req)) return next()
    const url = req.url
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers))
      for (const v of [value ?? []].flat()) headers.append(name, v)
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream)
    const request = new Request(new URL(url, `http://${req.headers.host}`), {
      method: req.method,
      headers,
      body,
      duplex: 'half',
    } as RequestInit)
    load()
      .then((app) => app.fetch(request))
      .then(async (response) => {
        const page = response.headers.get('content-type')?.startsWith('text/html')
        const out = page
          ? Buffer.from(inject(await documentOf(url), await response.text()))
          : Buffer.from(await response.arrayBuffer())
        res.statusCode = response.status
        response.headers.forEach(
          (value, name) => name !== 'set-cookie' && name !== 'content-length' && res.setHeader(name, value),
        )
        const cookies = response.headers.getSetCookie()
        if (cookies.length) res.setHeader('set-cookie', cookies)
        res.end(out)
      })
      .catch(next)
  }
