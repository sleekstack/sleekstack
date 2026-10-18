import { defineConfig } from 'vite'
import { sleekContent } from '../../index'

export default defineConfig({
  logLevel: 'silent',
  build: { outDir: 'dist', rollupOptions: { output: { format: 'iife' } } },
  plugins: [
    sleekContent({
      content: `${import.meta.dirname}/content`,
      app: 'app.ts',
      og: { site: 'https://docs.test', fonts: [{ name: 'Inter', file: 'inter-700.woff', weight: 700 }] },
      prerender: { server: 'server.tsx', client: 'main.tsx' },
    }),
  ],
})
