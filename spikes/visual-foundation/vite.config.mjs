import { defineConfig } from 'vite';

// Lecture kernels live in sibling spikes (spikes/<id>/kernel.mjs); the dev server may read them.
// Kernels run in a module worker (src/stations/kernel-worker.ts), which lazy-loads them: ES format.
export default defineConfig({
  server: { fs: { allow: ['..'] } },
  worker: { format: 'es' },
});
