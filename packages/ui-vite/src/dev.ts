import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { Start } from '@sleekstack/start'

/**
 * Connect middleware for the Vite dev server: a request `accepts` goes, as a web `Request`, to the `start` entry that
 * `load` returns; every other request goes on to Vite. `accepts` may answer later, as the discovered app's
 * `isControllerPath` does once its module is loaded:
 *
 * @example
 * ```ts
 * devMiddleware(
 *   async () => (await server.ssrLoadModule('/server/app.ts')).app,
 *   async (pathname) =>
 *     pathname.startsWith('/_sleek/') ||
 *     (await server.ssrLoadModule('virtual:sleek/server-app')).isControllerPath(pathname),
 * )
 * ```
 */
export const devMiddleware =
  (load: () => Promise<Start>, accepts: (pathname: string) => boolean | Promise<boolean>) =>
  (req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): void => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const forward = async () => {
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers))
        for (const v of [value ?? []].flat()) headers.append(name, v)
      const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream)
      const request = new Request(url, { method: req.method, headers, body, duplex: 'half' } as RequestInit)
      const response = await (await load()).fetch(request)
      res.statusCode = response.status
      response.headers.forEach((value: string, name: string) => name !== 'set-cookie' && res.setHeader(name, value))
      const cookies = response.headers.getSetCookie()
      if (cookies.length) res.setHeader('set-cookie', cookies)
      res.end(Buffer.from(await response.arrayBuffer()))
    }
    Promise.resolve()
      .then(() => accepts(url.pathname))
      .then((accepted) => (accepted ? forward().catch(next) : next()), next)
  }
