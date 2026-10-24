import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devMiddleware, serverServices } from '@sleekstack/ui-vite'

export default defineConfig({
  plugins: [
    react(),
    // Server Services and Controllers: generates `virtual:sleek/server`, its registry and `virtual:sleek/rpc` from
    // `server/rpc.ts`, and `virtual:sleek/server-app` from `server/routes`, and keeps server files out of the browser.
    serverServices(),
    {
      // The server on the dev server (`/_sleek/` and the Controller paths): `server/app.ts`, loaded through Vite so an
      // edit to it applies on the next call.
      name: 'showcase:start',
      configureServer: (server) => {
        server.middlewares.use(
          devMiddleware(
            async () => (await server.ssrLoadModule('/server/app.ts')).app,
            async (pathname) =>
              pathname.startsWith('/_sleek/') ||
              (await server.ssrLoadModule('virtual:sleek/server-app')).isControllerPath(pathname),
          ),
        )
      },
    },
  ],
})
