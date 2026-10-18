import { sleekContent } from '@sleekstack/ui-vite'
import { defineConfig } from 'vite'

/** Route prefix and site origin come from the environment so the same build serves under any prefix. */
const base = process.env.VITE_DOCS_BASE ?? '/docs'
const DEFAULT_SITE = 'https://sleekstack.dev'
const site = process.env.VITE_DOCS_SITE ?? DEFAULT_SITE

export default defineConfig({
  plugins: [
    sleekContent({
      content: 'content/docs',
      base,
      app: 'src/app.tsx',
      prerender: { server: 'src/server.tsx', client: 'src/main.tsx' },
      og: { site, fonts: [{ name: 'Inter', file: 'fonts/inter-700.woff', weight: 700 }] },
    }),
  ],
  define: {
    'import.meta.env.VITE_DOCS_BASE': JSON.stringify(base),
    'import.meta.env.VITE_DOCS_SITE': JSON.stringify(site),
  },
})
