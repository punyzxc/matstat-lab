import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Static build only: `vite build` writes dist/, any static host serves it. No server process.
// The product build has one entry (index.html, the one Orbital scene). `--mode smoke` adds the
// test-only smoke page for Playwright, so it is never deployed.
export default defineConfig(({ mode }) => ({
  base: './',
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ...(mode === 'smoke' ? { smoke: resolve(import.meta.dirname, 'smoke.html') } : {}),
      },
    },
  },
}));
