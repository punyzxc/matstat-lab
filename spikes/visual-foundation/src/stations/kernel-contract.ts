/**
 * The shared lecture-kernel contract (docs/research/lecture-module-map.md).
 * A kernel is a plain ES module `spikes/<id>/kernel.mjs`; it never touches the DOM.
 */
export type KernelParam = { key: string; label: string; min: number; max: number; step: number; default: number };
export type KernelMeta = { id: string; lectures: string[]; title: string; params: KernelParam[] };
export type Readout = { key: string; label: string; observed?: number | string | null; theory?: number | string | null; unit?: string; convention?: string };
export type SeriesKind = 'pmf' | 'pdf' | 'cdf' | 'hist' | 'ecdf' | 'line' | 'points' | 'band';
export type Series = { id: string; kind: SeriesKind; x: number[]; y: number[]; y2?: number[]; unit?: string; label?: string };
export type KernelResult = { readouts: Readout[]; series: Series[]; notes: string[] };
export type Kernel = {
  meta: KernelMeta;
  run: (params: Record<string, number>, options: { seed: number; station?: string }) => KernelResult;
  /** Optional: one kernel may serve several stations (e.g. Moments, Transform, Scatter). */
  stations?: Record<string, { params?: KernelParam[] }>;
};

/** Defaults for every declared parameter, then any valid override clamped to its range and step grid. */
export function resolveParams(params: KernelParam[], overrides: Record<string, number> = {}) {
  const out: Record<string, number> = {};
  for (const p of params) {
    const raw = overrides[p.key];
    const value = Number.isFinite(raw) ? Math.min(p.max, Math.max(p.min, raw)) : p.default;
    const snapped = p.min + Math.round((value - p.min) / p.step) * p.step;
    out[p.key] = Number(Math.min(p.max, snapped).toPrecision(12));
  }
  return out;
}

export function isKernel(value: unknown): value is Kernel {
  const k = value as Kernel;
  return Boolean(k && typeof k.run === 'function' && k.meta && Array.isArray(k.meta.params));
}
