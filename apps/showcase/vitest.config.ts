import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// `server-only` throws when imported outside Next's server bundler; tests
// run under plain Node/jsdom, so it's aliased to an empty module.
// `next/headers`'s `cookies()` needs Next's request AsyncLocalStorage;
// aliased to a test-controlled jar (requests.test.ts, R9).
const alias = {
  'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
  'next/headers': fileURLToPath(new URL('./src/test/next-headers-stub.ts', import.meta.url)),
}

// The app's tsconfig sets `jsx: "preserve"` for Next's own compiler; Vite 8's
// default oxc transform inherits that and can't parse JSX, so it's
// overridden here.
const jsx = { oxc: { jsx: { runtime: 'automatic' as const } } }

export default defineConfig({
  resolve: { alias },
  ...jsx,
  test: {
    // Two projects (R11): `*.test.ts` (services, graph, errors, request
    // scopes) run in `node`; `*.test.tsx` (client components) run in
    // `jsdom`, since a single environment can't serve both.
    projects: [
      {
        resolve: { alias },
        ...jsx,
        test: { name: 'node', testTimeout: 20_000, environment: 'node', include: ['src/**/*.test.ts'] },
      },
      {
        resolve: { alias },
        ...jsx,
        test: { name: 'jsdom', testTimeout: 20_000, environment: 'jsdom', include: ['src/**/*.test.tsx'] },
      },
    ],
  },
})
