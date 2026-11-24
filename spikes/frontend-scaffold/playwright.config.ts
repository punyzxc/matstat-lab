import { defineConfig, devices } from '@playwright/test';

// Tests the BUILT app through `vite preview` (static files), never the dev server.
// A dedicated port with strictPort and no reuse, so another checkout's server is never tested by mistake.
const port = Number(process.env.PORT ?? 4231);
const channel = process.env.PW_CHANNEL ?? (process.env.CI ? undefined : 'chrome');

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '*.spec.ts',
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    ...devices['Desktop Chrome'],
    ...(channel ? { channel } : {}),
  },
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
