import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Solid's node export is the SSR build (signals are inert); the browser build has the reactive runtime.
  resolve: { alias: { 'solid-js': 'solid-js/dist/solid.js' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    benchmark: { include: ['src/**/*.bench.ts'] },
  },
})
