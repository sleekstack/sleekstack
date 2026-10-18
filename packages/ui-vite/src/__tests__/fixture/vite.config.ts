import { defineConfig } from 'vite'
import { sleekContent } from '../../index'

export default defineConfig({
  logLevel: 'silent',
  build: { outDir: 'dist', rollupOptions: { output: { format: 'iife' } } },
  plugins: [
    sleekContent({
      content: `${import.meta.dirname}/content`,
      app: 'app.ts',
      prerender: { server: 'server.tsx', client: 'main.tsx' },
    }),
  ],
})
