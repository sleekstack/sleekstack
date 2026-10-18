import { defineConfig } from 'vitest/config'

// tsconfig keeps `jsx: preserve` for Next; the tests need the files' `@jsxImportSource` pragma compiled.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
