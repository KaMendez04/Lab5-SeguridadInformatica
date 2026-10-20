// Pruebas E2E de UNA-chat.
// - Con APP_URL definida se prueban contra la app desplegada (Render).
// - Sin APP_URL se levanta el servidor local en el puerto 3000.
const { defineConfig, devices } = require('@playwright/test');

const appUrl = process.env.APP_URL;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60 * 1000,
  expect: { timeout: 15 * 1000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: appUrl || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: appUrl ? undefined : {
    command: 'node server.js',
    url: 'http://localhost:3000/healthz',
    reuseExistingServer: !process.env.CI
  }
});
