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
})
