/**
 * The shared lecture-kernel contract (docs/research/lecture-module-map.md).
 * A kernel is a plain ES module `spikes/<id>/kernel.mjs`; it never touches the DOM.
 */
export type KernelParam = { key: string; label: string; min: number; max: number; step: number; default: number };
export type KernelMeta = { id: string; lectures: string[]; title: string; params: KernelParam[] };
export type Readout = { key: string; label: string; observed?: number | string | null; theory?: number | string | null; unit?: string; convention?: string };
export type SeriesKind = 'pmf' | 'pdf' | 'cdf' | 'hist' | 'ecdf' | 'line' | 'points' | 'band' | 'rule';
/** `tone`: default (observed), signal (theory / reference), muted (context), accent (critical region, highlight). */
/** `marker` (points only): a larger filled `dot` or an `open` circle, as for the ends of the steps of a right-continuous CDF. */
export type Series = { id: string; kind: SeriesKind; x: number[]; y: number[]; y2?: number[]; unit?: string; label?: string; tone?: 'default' | 'signal' | 'muted' | 'accent'; marker?: 'dot' | 'open' };
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
/**
 * Single experiments with a test decision (#137): `statistic[i]` and whether it was rejected, under the
 * `truth` that generated them (0: $H_0$, 1: $H_1$), with the exact rates to compare the shares against.
 */
export type Decisions = {
  truth: 0 | 1;
  statistic: number[];
  reject: boolean[];
  theory: { alpha: number; beta: number | null; power: number | null };
};
/**
 * A discrete law drawn as masses on a beam (#132): `p[i]` at `x[i]`, the fulcrum at `mean` = Σ x_i p_i and the
 * sample's centre of mass at `sampleMean`. `keys[i]` names the parameter that holds `x[i]`, so a dragged weight
 * changes it; `step` is that parameter's grid.
 */
export type Beam = { x: number[]; p: number[]; mean: number; sampleMean: number; range: [number, number]; keys: string[]; step: number };
/**
 * The outcome space of two dice mapped by X (#131): `values[i]` is X(ω) for the i-th of 36 outcomes (row ω₁, column
 * ω₂); `picks` are the outcome indices of the first experiments of this draw; `counts[k]` how many of the `n`
 * experiments gave `support[k]`, whose exact probability is `pmf[k]`; `x` is the bound of the event {X ≤ x}.
 */
export type Outcomes = { values: number[]; picks: number[]; support: number[]; pmf: number[]; counts: number[]; n: number; x: number };
/** A second chart under the main one, sharing its x axis (for example $F(x)$ under $f(x)$). */
export type LinkedChart = { series: Series[]; axes?: { x?: string; y?: string }; domain?: { x?: [number, number]; y?: [number, number] } };
/**
 * The outcome space of L1 (#129): `parts[i]` describes outcome i (two dice: [ω₁, ω₂]; three coins: 1 heads, 0 tails;
 * cards: [rank 6…14, suit 1…4]); its membership in A, B and the event shown (`event`, TeX); `flashes` are the
 * outcomes hit by the first trials of this draw; the event holds `m` of the `n` outcomes.
 */
export type Space = { kind: 'dice' | 'coins' | 'cards'; cols: number; parts: number[][]; inA: boolean[]; inB: boolean[]; inE: boolean[]; flashes: number[]; event: string; m: number; n: number };
/**
 * Combinatorial constructions (#130): `items` are constructions of `size` object indices out of `n` (every one when
 * `all`, else a sample); `count` is the exact number as a decimal string (it can exceed 2^53).
 */
export type Constructions = { n: number; size: number; ordered: boolean; repetition: boolean; items: number[][]; all: boolean; count: string };
export type KernelResult = {
  readouts: Readout[];
  series: Series[];
  notes: string[];
  axes?: { x?: string; y?: string };
  surface?: Surface;
  /** A live formula above the chart: display-style TeX lines that carry the current numbers (#136). */
  formula?: string[];
  decisions?: Decisions;
  beam?: Beam;
  /** Fixed axis ranges of the main chart. */
  domain?: { x?: [number, number]; y?: [number, number] };
  linked?: LinkedChart;
  outcomes?: Outcomes;
  space?: Space;
  constructions?: Constructions;
};
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
