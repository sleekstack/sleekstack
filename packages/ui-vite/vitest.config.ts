import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // real Vite builds and docs-tree compiles; CI runners are slow
    testTimeout: 120_000,
    fileParallelism: false,
    hookTimeout: 180_000,
  },
})
