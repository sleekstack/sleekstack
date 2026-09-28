import { defineConfig } from '@playwright/test'

// R11: smoke against the production server (`next start`); run `build` first.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3100' },
  webServer: { command: 'pnpm start -p 3100', url: 'http://localhost:3100', reuseExistingServer: !process.env.CI },
})
