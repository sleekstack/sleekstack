import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // CI runs many suites in parallel: the 5s default is below a slow runner's worst case.
    testTimeout: 20_000,
    environment: 'jsdom',
    passWithNoTests: true,
  },
})
