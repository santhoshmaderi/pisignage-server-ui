import { defineConfig, devices } from '@playwright/test'

/**
 * E2E config for the pisignage v2 UI.
 *
 * The app is served by the pisignage server under `/v2/`, so baseURL ends in
 * `/v2/` and specs use RELATIVE paths (e.g. `page.goto('players')`).
 *
 * Default target is the running server at http://localhost:3000/v2/.
 * Override with E2E_BASE_URL for a different host/port, e.g.
 *   E2E_BASE_URL=http://192.168.0.10:3000/v2/ npm run test:e2e
 *
 * The server must be running with the v2 build deployed (npm run deploy:local)
 * and login pi/pi.
 */
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000/v2/'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
