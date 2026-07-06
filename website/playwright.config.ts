import { defineConfig, devices } from '@playwright/test';

// When PLAYWRIGHT_BASE_URL is set (e.g. the deploy pipeline pointing at
// staging.migralog.app / migralog.app) we test the live, deployed site and
// skip the local static server. Otherwise we serve website/ locally for dev.
const liveBaseURL = process.env.PLAYWRIGHT_BASE_URL;

// PLAYWRIGHT_CHANNEL=chrome runs the Chromium-family projects against an
// installed system browser instead of the downloaded Playwright build —
// handy on dev machines where the browser CDN is unreachable. CI leaves
// this unset.
const chromiumChannel = process.env.PLAYWRIGHT_CHANNEL
  ? { channel: process.env.PLAYWRIGHT_CHANNEL }
  : {};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: liveBaseURL || 'http://localhost:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...chromiumChannel },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], ...chromiumChannel },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],

  // Only spin up the local static server when testing locally. Against a live
  // URL there is nothing to serve.
  webServer: liveBaseURL
    ? undefined
    : {
        command: 'cd website && python3 -m http.server 8000',
        url: 'http://localhost:8000',
        reuseExistingServer: !process.env.CI,
        timeout: 5000,
      },
});
