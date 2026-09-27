import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      // `server-only` throws when imported outside Next's server bundler;
      // tests run under plain Node, so it's aliased to an empty module.
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
      // `next/headers`'s `cookies()` needs Next's request AsyncLocalStorage;
      // aliased to a test-controlled jar (requests.test.ts, R9).
      'next/headers': fileURLToPath(new URL('./src/test/next-headers-stub.ts', import.meta.url)),
    },
  },
})
