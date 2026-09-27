import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Two entries: the app itself, and a client-tags-only entry (R11) whose
      // build output src/__tests__/bundle.test.ts checks for server-impl leakage.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        'client-tags': fileURLToPath(new URL('./src/client-tags-entry.ts', import.meta.url)),
      },
    },
  },
})
