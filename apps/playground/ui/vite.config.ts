import { defineConfig } from 'vite'
import { sleekstack } from '@sleekstack/ui-vite'

export default defineConfig({
  plugins: [
    sleekstack({
      include: 'src/**/*.tsx',
      entries: { client: 'src/entry-client.ts', server: 'src/entry-server.ts' },
      prerender: true,
    }),
  ],
  // The client entry keeps its `started` export, so a test can await hydration.
  environments: { client: { build: { rollupOptions: { preserveEntrySignatures: 'exports-only' } } } },
})
