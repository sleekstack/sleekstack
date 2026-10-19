import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Each R4 case runs two real Vite builds (client + SSR); next to the other turbo test tasks on a CI runner
    // that takes over a minute, against ~10s locally.
    testTimeout: 180_000,
  },
})
