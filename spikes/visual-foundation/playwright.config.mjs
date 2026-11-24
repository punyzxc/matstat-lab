import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 4175);

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.mjs',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices['Desktop Chrome'],
    channel: 'chrome',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
  },
});
