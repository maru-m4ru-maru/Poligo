import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/ui-layout',
  fullyParallel: true,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'pnpm --dir apps/web dev --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
})
