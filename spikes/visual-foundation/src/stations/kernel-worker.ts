/// <reference lib="webworker" />
/**
 * Runs lecture kernels off the main thread, so a heavy simulation never freezes the scene, the globe
 * or the sliders. One request at a time; the host keeps only the latest pending request.
 */
import { isKernel, type Kernel } from './kernel-contract';

const sources = import.meta.glob('../../../*/kernel.mjs');
const loaded = new Map<string, Promise<Kernel>>();
function load(id: string) {
  let p = loaded.get(id);
  if (!p) {
    const importer = sources[`../../../${id}/kernel.mjs`];
    p = importer
      ? importer().then((mod) => {
          const k = (mod as { default?: unknown }).default ?? mod;
          if (!isKernel(k)) throw new Error('The module does not export meta and run().');
          return k;
        })
      : Promise.reject(new Error(`No kernel ${id}`));
    loaded.set(id, p);
  }
  return p;
}

export type RunRequest = { id: number; kernel: string; station: string; params: Record<string, number>; seed: number };
export type RunReply = { id: number; ok: true; result: unknown; ms: number } | { id: number; ok: false; error: string; ms: number };

self.onmessage = async (e: MessageEvent<RunRequest>) => {
  const { id, kernel, station, params, seed } = e.data;
  const t0 = performance.now();
  try {
    const k = await load(kernel);
    const t1 = performance.now();
    const result = k.run(params, { seed, station });
    (self as unknown as Worker).postMessage({ id, ok: true, result, ms: performance.now() - t1 } satisfies RunReply);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err), ms: performance.now() - t0 } satisfies RunReply);
  }
};
