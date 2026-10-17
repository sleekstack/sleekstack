import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { Start } from '@sleekstack/start'

/**
 * Connect middleware for the Vite dev server: a request under `/_sleek/` goes, as a web `Request`, to the `start` entry
 * that `load` returns; every other request goes on to Vite.
 */
export const devMiddleware =
  (load: () => Promise<Start>) =>
  (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): void => {
    if (!req.url?.startsWith('/_sleek/')) return next()
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers))
      for (const v of [value ?? []].flat()) headers.append(name, v)
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream)
    const request = new Request(new URL(req.url, `http://${req.headers.host}`), {
      method: req.method,
      headers,
      body,
      duplex: 'half',
    } as RequestInit)
    load()
      .then((app) => app.fetch(request))
      .then(async (response) => {
        res.statusCode = response.status
        response.headers.forEach((value, name) => name !== 'set-cookie' && res.setHeader(name, value))
        const cookies = response.headers.getSetCookie()
        if (cookies.length) res.setHeader('set-cookie', cookies)
        res.end(Buffer.from(await response.arrayBuffer()))
      })
      .catch(next)
  }
