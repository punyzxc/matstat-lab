import { defineConfig } from 'vite';

// Lecture kernels live in sibling spikes (spikes/<id>/kernel.mjs); the dev server may read them.
export default defineConfig({
  server: { fs: { allow: ['..'] } },
});
