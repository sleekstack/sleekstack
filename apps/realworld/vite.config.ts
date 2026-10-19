import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import { devMiddleware } from './server/dev'

export default defineConfig({
  plugins: [
    {
      // The server on the dev server: `server/app.ts`, loaded through Vite so an edit to it applies on the next request.
      // Registered here, not in a returned hook, so page navigations reach it before Vite's own `index.html`.
      name: 'realworld:start',
      configureServer: (server) => {
        server.middlewares.use(
          devMiddleware(
            async () => (await server.ssrLoadModule('/server/app.ts')).app,
            async (url) =>
              server.transformIndexHtml(url, await readFile(join(server.config.root, 'index.html'), 'utf8')),
          ),
        )
      },
    },
  ],
})
