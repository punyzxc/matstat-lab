import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Static build only: `vite build` writes dist/, any static host serves it. No server process.
// Two entries: the product (index.html, the one Orbital scene) and a test-only smoke page.
export default defineConfig({
  base: './',
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        smoke: resolve(import.meta.dirname, 'smoke.html'),
      },
    },
  },
});
