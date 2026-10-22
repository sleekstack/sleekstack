import { devMiddleware } from '@sleekstack/ui-vite'
import type { Plugin } from 'vite'

/**
 * Dev only: Server Service calls and every path a Controller serves go to the `start` entry; Vite serves the rest.
 * `isControllerPath` comes from the discovered app, so a new Controller is forwarded without editing this file.
 */
export const serveApp = (): Plugin => ({
  name: 'serve-app',
  configureServer(server) {
    server.middlewares.use(
      devMiddleware(
        async () => (await server.ssrLoadModule('/server/app.ts')).app,
        async (pathname) =>
          pathname.startsWith('/_sleek/') ||
          (await server.ssrLoadModule('virtual:sleek/server-app')).isControllerPath(pathname),
      ),
    )
  },
})
