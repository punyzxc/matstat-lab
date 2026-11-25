/**
 * The shared lecture-kernel contract (docs/research/lecture-module-map.md).
 * A kernel is a plain ES module `spikes/<id>/kernel.mjs`; it never touches the DOM.
 */
/** `when`: show the parameter only while other parameters take one of the listed values, e.g. `{ view: [3] }`. */
export type ParamCondition = Record<string, number[]>;
export type KernelParam = { key: string; label: string; min: number; max: number; step: number; default: number; when?: ParamCondition };
/**
 * A typed text parameter (#90), such as a region `y < x^2`. The host validates it with the kernel's `checkText`
 * before every run, so the kernel only ever receives a valid text; `presets` are offered as chips.
 */
export type TextParam = { key: string; label: string; default: string; presets?: string[]; when?: ParamCondition };
/** A text the kernel rejected: the English `message`, and its `template` with `[[n]]` holes for `values` (for translation). */
export type TextCheck = { message: string; template: string; values: string[] } | null;
export type KernelMeta = { id: string; lectures: string[]; title: string; params: KernelParam[] };
export type Readout = { key: string; label: string; observed?: number | string | null; theory?: number | string | null; unit?: string; convention?: string };
export type SeriesKind = 'pmf' | 'pdf' | 'cdf' | 'hist' | 'ecdf' | 'line' | 'points' | 'band' | 'rule';
/** `tone`: default (observed), signal (theory / reference), muted (context), accent (critical region, highlight); ghost-a…d are drawn by the station for snapshots (#114), never by a kernel. */
/** `thin` (lines only): a faint hairline, for bundles of many paths (#116). */
/** `marker` (points only): a larger filled `dot` or an `open` circle, as for the ends of the steps of a right-continuous CDF. */
export type Series = { id: string; kind: SeriesKind; x: number[]; y: number[]; y2?: number[]; unit?: string; label?: string; tone?: 'default' | 'signal' | 'muted' | 'accent' | `ghost-${'a' | 'b' | 'c' | 'd'}`; marker?: 'dot' | 'open'; thin?: boolean };
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
  /** #84: draw `z` as a field of boxes, one per node, instead of a surface. */
  bars?: boolean;
  /** #84: a translucent surface on the same grid over the main one (an approximation), with its legend text. */
  overlay?: number[][];
  overlayLabel?: string;
  /** #86: a reference curve z(x) drawn on the far wall. */
  wall?: { x: number[]; z: number[]; label: string };
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
/**
 * A board of live throws (#90): Buffon's needles over lines `d` apart (`needles[i]` = [x, y, θ] of the centre and
 * angle, `hits[i]` whether it crosses a line), or darts in the unit square over a typed region drawn as `runs` of
 * grid cells [x0, y0, width, height].
 */
/**
 * #128: one quantity three ways: its exact value, an approximation (a limit theorem, a formula) and the simulated
 * estimate. Each part is optional; `series` names the chart series that shows it, lit while the value is hovered.
 */
export type MeetValue = { value: number; label: string; series?: string };
export type Meet = { label: string; exact?: MeetValue; approx?: MeetValue; sim?: MeetValue };
export type Board =
  | { kind: 'needles'; d: number; l: number; strips: number; width: number; needles: number[][]; hits: boolean[] }
  | { kind: 'region'; runs: number[][]; darts: number[][]; hits: boolean[] }
  /** #119: a region of [0, 1] as `intervals` [x0, width]; `darts[i]` = [x, spread], the spread only for drawing. */
  | { kind: 'segment'; intervals: number[][]; darts: number[][]; hits: boolean[] }
  /** #119: points [x, y, z] in the unit cube, `hits[i]` whether each is in the region. */
  | { kind: 'cube'; darts: number[][]; hits: boolean[] }
  /** #124: Bertrand's three circles; `chords[i]` = [x1, y1, x2, y2] on the unit circle, `long[i]` longer than √3. */
  | { kind: 'chords'; circles: { id: string; label: string; exact: number; share: number; chords: number[][]; long: boolean[] }[] };
/**
 * Two events in the unit square (#117): A = `A` and B = `B` as [x0, x1, y0, y1], their exact probabilities, whether
 * |P(AB) − P(A)P(B)| is within the kernel's tolerance, the first `points` of the draw with their class `cls`
 * (bit 1: in A, bit 2: in B), and the parameters `keys` that set the edges (a, s, b, h) on a grid of `step`.
 */
export type EventSquare = {
  A: number[]; B: number[]; P: { A: number; B: number; AB: number; AgB: number | null }; independent: boolean; gap: number;
  points: number[][]; cls: number[]; keys: { a: number; s: number; b: number; h: number }; step: number;
};
/**
 * The Bayes tree (#118): normalised `priors` P(H_i), likelihoods `lik` P(A | H_i), `joint` P(H_i)P(A | H_i), the
 * total P(A) and the posteriors (null when P(A) = 0); particle counts per hypothesis `H` and per hypothesis with A
 * `HA` out of `n`, `A` in all; `particles[i]` = [i of H, 1 if A] for the first particles of the draw.
 */
export type BayesTree = {
  priors: number[]; lik: number[]; joint: number[]; pA: number; post: number[] | null;
  H: number[]; HA: number[]; A: number; n: number; particles: number[][]; keys: string[];
};
/**
 * The characteristic function on the complex plane (#121): the sample `xs`, how many vectors to draw (`shown`), the
 * t range [-T, T], the typed `t`, whether t sweeps by itself (`motion`), and the exact φ on the grid `ts` as [re, im].
 */
export type Phasor = {
  xs: number[]; shown: number; T: number; t: number; motion: boolean; ts: number[]; exact: [number, number][]; symmetric: boolean;
  /** #122: the factors of a product φ_X φ_Y (then `exact` is the product and `xs` are the sums x_j + y_j). */
  parts?: { key: string; exact: [number, number][] }[];
};
/**
 * The independent-trials machine (#115): the first series of n trials with success probability p, each as its count k
 * and its trials folded into `cells` (share of successes per cell); the k `window` drawn and the exact law on it.
 */
export type TrialsMachine = { n: number; p: number; rows: { k: number; cells: number[] }[]; window: [number, number]; exact: (number | null)[] };
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
  board?: Board;
  meet?: Meet;
  square?: EventSquare;
  tree?: BayesTree;
  phasor?: Phasor;
  machine?: TrialsMachine;
};
export type Kernel = {
  meta: KernelMeta;
  run: (params: Record<string, number | string>, options: { seed: number; station?: string }) => KernelResult;
  /** Optional: one kernel may serve several stations (e.g. Moments, Transform, Scatter). */
  /** `live`: the host re-runs the kernel on every slider move (draft parameters) and morphs the output. */
  stations?: Record<string, { params?: KernelParam[]; live?: boolean; texts?: TextParam[] }>;
  /** Validates a text parameter: null when it can run, otherwise what is wrong. */
  checkText?: (station: string, key: string, value: string) => TextCheck;
};

/** Whether a parameter applies under the current numeric parameters (no `when`: always). */
export const applies = (when: ParamCondition | undefined, params: Record<string, number>) =>
  !when || Object.entries(when).every(([k, vs]) => vs.includes(params[k]));

/** Text parameters: defaults, then each override the kernel accepts. */
export function resolveTexts(kernel: Pick<Kernel, 'checkText'>, station: string, texts: TextParam[], overrides: Record<string, string> = {}) {
  const out: Record<string, string> = {};
  for (const p of texts) {
    const raw = overrides[p.key];
    out[p.key] = typeof raw === 'string' && raw.trim() && !kernel.checkText?.(station, p.key, raw) ? raw : p.default;
  }
  return out;
}

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
