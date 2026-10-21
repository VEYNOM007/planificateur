import { defineConfig } from '@playwright/test';

const PORT = 4173;
const HOST = '127.0.0.1';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run preview -- --host ${HOST} --port ${PORT} --strictPort`,
    url: `http://${HOST}:${PORT}`,
    timeout: 120000,
    reuseExistingServer: false,
  },
});
