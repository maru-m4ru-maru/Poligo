module.exports = {
  testDir: './e2e',
  timeout: 180000,
  expect: {
    timeout: 15000
  },
  retries: 1,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.POLIGO_E2E_BASE_URL || 'https://poligo-web-2n2l.onrender.com',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
}
