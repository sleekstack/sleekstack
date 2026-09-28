import { defineConfig } from '@playwright/test'

// R9: smoke against the production server (`next start`); run `build` first.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:3200' },
  webServer: { command: 'pnpm start -p 3200', url: 'http://localhost:3200', reuseExistingServer: !process.env.CI },
})
