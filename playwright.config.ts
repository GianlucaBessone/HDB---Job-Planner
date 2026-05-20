import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E testing configuration for HDB SGI.
 */
export default defineConfig({
  testDir: './tests',
  // Run all tests sequentially to prevent concurrent database write conflicts
  fullyParallel: false,
  workers: 1,
  
  // Retry once on failure to account for transient SW registration times
  retries: 1,
  
  reporter: [['html', { open: 'never' }]],
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Bypass system browser binary download issue on Ubuntu 26.04 by using system Google Chrome
    channel: 'chrome',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Hook into the Next.js dev server, reusing it if already running
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
