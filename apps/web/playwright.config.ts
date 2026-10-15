import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    {
      command: 'node ../api/dist/main.js',
      url: 'http://127.0.0.1:3101/api/v1/health',
      env: { PORT: '3101', HOST: '127.0.0.1' },
      reuseExistingServer: false,
    },
    {
      command: 'npm run start -- --port 3100',
      url: 'http://127.0.0.1:3100',
      env: { API_BASE_URL: 'http://127.0.0.1:3101' },
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
