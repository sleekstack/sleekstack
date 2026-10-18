import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devMiddleware } from './server/dev'

export default defineConfig({
  plugins: [
    react(),
    {
      // Server functions on the dev server: `server/app.ts`, loaded through Vite so an edit to it applies on the next call.
      name: 'showcase:start',
      configureServer: (server) => {
        server.middlewares.use(devMiddleware(async () => (await server.ssrLoadModule('/server/app.ts')).app))
      },
    },
  ],
})
