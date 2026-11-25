/**
 * The shared lecture-kernel contract (docs/research/lecture-module-map.md).
 * A kernel is a plain ES module `spikes/<id>/kernel.mjs`; it never touches the DOM.
 */
export type KernelParam = { key: string; label: string; min: number; max: number; step: number; default: number };
export type KernelMeta = { id: string; lectures: string[]; title: string; params: KernelParam[] };
export type Readout = { key: string; label: string; observed?: number | string | null; theory?: number | string | null; unit?: string; convention?: string };
export type SeriesKind = 'pmf' | 'pdf' | 'cdf' | 'hist' | 'ecdf' | 'line' | 'points' | 'band' | 'rule';
/** `tone`: default (observed), signal (theory / reference), muted (context), accent (critical region, highlight). */
export type Series = { id: string; kind: SeriesKind; x: number[]; y: number[]; y2?: number[]; unit?: string; label?: string; tone?: 'default' | 'signal' | 'muted' | 'accent' };
/**
 * A 3D surface over a regular grid (up to ~41x41). `z[j][i]` is the theoretical density at (x[i], y[j]);
 * `zSample[j][i]` is the sample's 2D-histogram density on the same grid (cell centred at the grid node).
 */
export type Surface = {
  x: number[];
  y: number[];
  z: number[][];
  zSample?: number[][];
  labels: { x: string; y: string; z: string };
  title?: string;
  /** Legend text for the `zSample` stems; defaults to the 2D-histogram wording. */
  sampleLabel?: string;
};
export type KernelResult = { readouts: Readout[]; series: Series[]; notes: string[]; axes?: { x?: string; y?: string }; surface?: Surface };
export type Kernel = {
  meta: KernelMeta;
  run: (params: Record<string, number>, options: { seed: number; station?: string }) => KernelResult;
  /** Optional: one kernel may serve several stations (e.g. Moments, Transform, Scatter). */
  /** `live`: the host re-runs the kernel on every slider move (draft parameters) and morphs the output. */
  stations?: Record<string, { params?: KernelParam[]; live?: boolean }>;
};

/** Defaults for every declared parameter, then any valid override clamped to its range and step grid. */
export function resolveParams(params: KernelParam[], overrides: Record<string, number> = {}) {
  const out: Record<string, number> = {};
  for (const p of params) {
    const lo = Math.min(p.min, p.max), hi = Math.max(p.min, p.max);
    const raw = overrides[p.key];
    if (!Number.isFinite(raw)) {
      out[p.key] = p.default;
      continue;
    }
    const value = Math.min(hi, Math.max(lo, raw));
    // Snap to the step grid from min; the ends of the range always stay reachable.
    const snapped = p.step > 0 && value !== hi && value !== lo ? lo + Math.round((value - lo) / p.step) * p.step : value;
    out[p.key] = Number(Math.min(hi, Math.max(lo, snapped)).toPrecision(12));
  }
  return out;
}

export function isKernel(value: unknown): value is Kernel {
  const k = value as Kernel;
  return Boolean(k && typeof k.run === 'function' && k.meta && Array.isArray(k.meta.params));
}
