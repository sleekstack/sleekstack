import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { Start } from '@sleekstack/start'

/** The `index.html` document for `url`, as Vite serves it; the rendered page goes into its `<div id="app">`. */
export type DocumentOf = (url: string) => Promise<string>

/** Whether a Controller serves `pathname`: `isControllerPath` of `virtual:sleek/server-app`, once it has loaded. */
export type IsControllerPath = (pathname: string) => boolean | Promise<boolean>

const APP = '<div id="app"></div>'
// A replacer function, so a `$&` in the page stays literal.
const inject = (document: string, page: string) => document.replace(APP, () => `<div id="app">${page}</div>`)

/** Server Service calls, page navigations and Controller paths go to `start`; Vite serves modules and assets. */
const forStart = (req: IncomingMessage, pathname: string, isControllerPath: IsControllerPath) =>
  req.url!.startsWith('/_sleek/') ||
  ((req.method === 'GET' || req.method === 'HEAD') && (req.headers.accept ?? '').includes('text/html')) ||
  isControllerPath(pathname)

/**
 * Connect middleware for the Vite dev server: a Server Service call, a page navigation or a request to a Controller
 * path goes, as a web `Request`, to the `start` entry that `load` returns; every other request goes on to Vite. An
 * HTML answer (a server-rendered page) is sent inside the document `documentOf` gives.
 */
export const devMiddleware =
  (load: () => Promise<Start>, documentOf: DocumentOf, isControllerPath: IsControllerPath) =>
  (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): void => {
    if (!req.url) return next()
    const url = req.url
    const target = new URL(url, `http://${req.headers.host}`)
    const forward = async () => {
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers))
        for (const v of [value ?? []].flat()) headers.append(name, v)
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream)
      const request = new Request(target, { method: req.method, headers, body, duplex: 'half' } as RequestInit)
      const response = await (await load()).fetch(request)
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
    }
    Promise.resolve()
      .then(() => forStart(req, target.pathname, isControllerPath))
      .then((yes) => (yes ? forward().catch(next) : next()), next)
  }
