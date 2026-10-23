import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { serverServices, sleekstack } from '@sleekstack/ui-vite'
import { defineConfig } from 'vitest/config'
import { devMiddleware } from './server/dev'

/** `virtual:sleekstack/routes` from `src/routes`: the file-routes plugin alone, the only part of `sleekstack()` used here. */
export const routes = () => sleekstack().filter((p) => p.name === 'sleekstack:routes')

export default defineConfig({
  plugins: [
    routes(),
    // Server Services and Controllers: generates `virtual:sleek/server` and its registry from the contracts and
    // `virtual:sleek/server-app` from `server/routes`, and keeps server files out of the browser.
    serverServices(),
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
            async (pathname) => (await server.ssrLoadModule('virtual:sleek/server-app')).isControllerPath(pathname),
          ),
        )
      },
    },
  ],
  test: {
    // The page tests drive real SSR, hydration, scrypt and SQLite end to end (~0.5 s for the auth flow here); a CI
    // runner shared with the other turbo test tasks runs them ~10x slower, past the 5 s default.
    testTimeout: 30_000,
  },
})
