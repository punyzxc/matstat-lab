// Lecture kernel for L10 and L12: sample, variation series, frequency table, histogram, ECDF,
// the Kolmogorov test and Pearson's χ² test (#45). Contract: docs/research/lecture-module-map.md.
// Stations: `sample` (L10 §Sample … §Empirical distribution function) and `fit` (L10 §Kolmogorov, §Pearson; L12).
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import {
  chiSquareQuantile, chiSquareSf, kolmogorovExactCdf, kolmogorovK, kolmogorovQuantile, normalCdf, normalPdf,
} from './special.mjs';

// ---------------------------------------------------------------- laws
// The three laws of L12 (normal, uniform, exponential), all with mean 1 and variance 1,
// so that a test that tells them apart reacts to shape, not to location or scale.
const R3 = Math.sqrt(3);
export const LAWS = [
  {
    id: 'normal', label: 'Normal N(1, 1)', mean: 1, variance: 1, skew: 0, exKurt: 0,
    cdf: (x) => normalCdf(x - 1), pdf: (x) => normalPdf(x - 1),
    range: [1 - 4, 1 + 4],
    family: { r: 2, label: 'N(x̄, σ²)', cdf: ([m, s]) => (x) => normalCdf((x - m) / s) },
  },
  {
    id: 'uniform', label: `Uniform U(1 − √3, 1 + √3)`, mean: 1, variance: 1, skew: 0, exKurt: -1.2,
    cdf: (x) => Math.min(1, Math.max(0, (x - (1 - R3)) / (2 * R3))),
    pdf: (x) => (x >= 1 - R3 && x <= 1 + R3 ? 1 / (2 * R3) : 0),
    range: [1 - R3 - 0.5, 1 + R3 + 0.5],
    family: { r: 2, label: 'U(a*, b*)', cdf: ([a, b]) => (x) => Math.min(1, Math.max(0, (x - a) / (b - a))) },
  },
  {
    id: 'exponential', label: 'Exponential Exp(1)', mean: 1, variance: 1, skew: 2, exKurt: 6,
    cdf: (x) => (x <= 0 ? 0 : -Math.expm1(-x)), pdf: (x) => (x < 0 ? 0 : Math.exp(-x)),
    range: [0, 7],
    family: { r: 1, label: 'Exp(λ*)', cdf: ([l]) => (x) => (x <= 0 ? 0 : -Math.expm1(-l * x)) },
  },
];
const lawLabel = LAWS.map((l, i) => `${i} ${l.id}`).join(', ');

const NAMESPACE = 0x45;
const unit = (seed, stream, index) => (fixtureUint32(seed, stream, index, NAMESPACE) + 0.5) / 2 ** 32;

/** n draws from LAWS[law], stream `stream`; inverse transform (uniform, exponential), Box–Muller (normal). */
export function drawSample(law, n, seed, stream = 0) {
  const x = new Array(n);
  for (let i = 0; i < n; i++) {
    const u = unit(seed, stream, 2 * i);
    if (law === 0) x[i] = 1 + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * unit(seed, stream, 2 * i + 1));
    else if (law === 1) x[i] = 1 - R3 + 2 * R3 * u;
    else x[i] = -Math.log1p(-u);
  }
  return x;
}
const roundTo = (x, digits) => (digits > 0 ? Math.round(x * 10 ** digits) / 10 ** digits : x);

// ---------------------------------------------------------------- L10: sample description
/** L10: k ≈ 5·lg n intervals, at least 1. */
export const defaultBinCount = (n) => Math.max(1, Math.round(5 * Math.log10(n)));

/** Variation series (119) and the simple statistical table (Table 10): distinct values and their counts m_r. */
export function variationSeries(sample) {
  const sorted = [...sample].sort((a, b) => a - b);
  const values = [], counts = [];
  for (const v of sorted) {
    if (values.length && values[values.length - 1] === v) counts[counts.length - 1]++;
    else { values.push(v); counts.push(1); }
  }
  return { sorted, values, counts };
}

/**
 * Interval frequency table (Table 11) on k equal intervals of length h = (x_max − x_min)/k.
 * Intervals are [e_r, e_{r+1}); the last one is closed so that x_max is counted. Heights H_r = W_r / h (L10).
 */
export function frequencyTable(sample, k) {
  const n = sample.length;
  let lo = Infinity, hi = -Infinity;
  for (const v of sample) { if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi === lo) { lo -= 0.5; hi += 0.5; } // all values equal: one unit-wide interval around them
  const h = (hi - lo) / k;
  const edges = Array.from({ length: k + 1 }, (_, r) => (r === k ? hi : lo + r * h));
  const counts = new Array(k).fill(0);
  for (const v of sample) counts[Math.min(k - 1, Math.floor((v - lo) / h))]++;
  const freq = counts.map((m) => m / n);
  const height = freq.map((w) => w / h);
  return { edges, h, counts, freq, height, area: height.reduce((s, H) => s + H * h, 0) };
}

/**
 * Empirical distribution function, convention Fₙ(x) = #{xᵢ ≤ x}/n (right-continuous).
 * Returned as its jump points: at each distinct value the step rises by m_r/n, so ties give one taller step.
 */
export function ecdf(sample) {
  const { values, counts } = variationSeries(sample);
  const n = sample.length;
  let c = 0;
  return { x: values, y: counts.map((m) => (c += m) / n) };
}
export const ECDF_CONVENTION = 'Fₙ(x) = #{xᵢ ≤ x}/n, right-continuous. The lecture (L5) defines F(x) = P(ξ < x); the two differ only at the jumps.';

/** Moments with divisor n, as in L12 (5)–(6): a_s = m₃/σ³, e_k = m₄/σ⁴ − 3. */
export function shapeMoments(sample) {
  const n = sample.length;
  const mean = sample.reduce((s, v) => s + v, 0) / n;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const v of sample) { const d = v - mean, d2 = d * d; m2 += d2; m3 += d2 * d; m4 += d2 * d2; }
  m2 /= n; m3 /= n; m4 /= n;
  return { mean, m2, s2: (m2 * n) / (n - 1), skew: m3 / m2 ** 1.5, exKurt: m4 / (m2 * m2) - 3 };
}

// ---------------------------------------------------------------- Kolmogorov (L10, L12)
/** Dₙ⁺ = max(i/n − F(x₍ᵢ₎)), Dₙ⁻ = max(F(x₍ᵢ₎) − (i−1)/n), Dₙ = max(D⁺, D⁻) (L12). */
export function kolmogorovStatistic(sample, F) {
  const sorted = [...sample].sort((a, b) => a - b);
  const n = sorted.length;
  let dPlus = 0, dMinus = 0, at = sorted[0];
  for (let i = 0; i < n; i++) {
    const f = F(sorted[i]);
    const up = (i + 1) / n - f, down = f - i / n;
    if (up > dPlus) dPlus = up;
    if (down > dMinus) dMinus = down;
    if (Math.max(up, down) >= Math.max(dPlus, dMinus)) at = sorted[i];
  }
  return { dPlus, dMinus, d: Math.max(dPlus, dMinus), at };
}

/** Exact critical value λₙ(α): P(Dₙ ≥ λₙ) = α. Stephens' start, then secant steps on the exact law. */
export function kolmogorovCritical(n, alpha) {
  const lam = kolmogorovQuantile(1 - alpha);
  const f = (d) => 1 - kolmogorovExactCdf(n, d) - alpha;
  let a = lam / (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n)), b = a * 1.01;
  let fa = f(a), fb = f(b);
  for (let i = 0; i < 30 && Math.abs(fb) > 1e-12 && fb !== fa; i++) {
    const c = b - (fb * (b - a)) / (fb - fa);
    a = b; fa = fb; b = c; fb = f(b);
  }
  return b;
}

/** Full Kolmogorov test of a fully specified continuous F. */
export function kolmogorovTest(sample, F, alpha) {
  const n = sample.length;
  const stat = kolmogorovStatistic(sample, F);
  const critical = kolmogorovCritical(n, alpha);
  const lambda = Math.sqrt(n) * stat.d;
  return {
    ...stat, n, lambda, critical,
    criticalAsymptotic: kolmogorovQuantile(1 - alpha) / Math.sqrt(n),
    pExact: 1 - kolmogorovExactCdf(n, stat.d),
    pAsymptotic: 1 - kolmogorovK(lambda),
    reject: stat.d >= critical,
  };
}

// ---------------------------------------------------------------- Pearson χ² (L10, L12)
/**
 * Pearson's test as in L12: s equal intervals between x_min and x_max, outer cells open to ±∞
 * (so the cell probabilities sum to 1), parameters estimated from the grouped sample (interval
 * midpoints) when `estimate`, df = s − 1 − r. With `merge`, neighbouring cells are joined until every
 * expected count is at least 5; without it, such cells are reported as a warning.
 */
export function pearsonTest(sample, law, { cells, alpha, estimate, merge }) {
  const n = sample.length;
  const table = frequencyTable(sample, cells);
  const mids = table.edges.slice(0, -1).map((e) => e + table.h / 2);
  let F = LAWS[law].cdf, params = null, r = 0;
  if (estimate) {
    const fam = LAWS[law].family;
    const mean = mids.reduce((s, m, i) => s + m * table.counts[i], 0) / n;
    const sigma = Math.sqrt(mids.reduce((s, m, i) => s + (m - mean) ** 2 * table.counts[i], 0) / n);
    params = law === 0 ? [mean, sigma] : law === 1 ? [mean - R3 * sigma, mean + R3 * sigma] : [1 / mean];
    F = fam.cdf(params);
    r = fam.r;
  }
  const inner = table.edges.slice(1, -1);
  const bounds = [-Infinity, ...inner, Infinity];
  let groups = table.counts.map((o, i) => ({ from: bounds[i], to: bounds[i + 1], observed: o, expected: n * (F(bounds[i + 1]) - F(bounds[i])) }));
  const smallBefore = groups.filter((g) => g.expected < 5).length;
  if (merge) groups = mergeCells(groups);
  const small = groups.filter((g) => g.expected < 5).length;
  const s = groups.length, df = s - 1 - r;
  let chi2 = 0;
  for (const g of groups) chi2 += g.expected > 0 ? (g.observed - g.expected) ** 2 / g.expected : g.observed > 0 ? Infinity : 0;
  const valid = df >= 1;
  const critical = valid ? chiSquareQuantile(1 - alpha, df) : null;
  return {
    groups, s, r, df, chi2, params, smallBefore, small, valid, critical,
    p: valid ? chiSquareSf(chi2, df) : null,
    reject: valid ? chi2 >= critical : null,
    warning: small > 0 ? `${small} cell${small === 1 ? '' : 's'} with expected count below 5: the χ² approximation is unreliable.` : null,
  };
}
function mergeCells(cells) {
  const out = [];
  let cur = null;
  for (const c of cells) {
    cur = cur ? { from: cur.from, to: c.to, observed: cur.observed + c.observed, expected: cur.expected + c.expected } : { ...c };
    if (cur.expected >= 5) { out.push(cur); cur = null; }
  }
  if (cur) {
    if (out.length) { const last = out.pop(); out.push({ from: last.from, to: cur.to, observed: last.observed + cur.observed, expected: last.expected + cur.expected }); }
    else out.push(cur);
  }
  return out;
}

// ---------------------------------------------------------------- Monte Carlo under H₀
/** MC work cap: replicates × n draws per run, so a parameter change stays interactive. */
export const MC_BUDGET = 300_000;
/**
 * Repeat the tests on samples drawn from H₀ itself (streams 1…R) and count false rejections.
 * Predeclared band: α ± 3·√(α(1 − α)/R).
 */
export function falseRejection(h0, n, seed, reps, opts) {
  const R = Math.min(reps, Math.floor(MC_BUDGET / n));
  let pearson = 0, pearsonRuns = 0, kolm = 0;
  const crit = R > 0 ? kolmogorovCritical(n, opts.alpha) : 0;
  for (let rep = 1; rep <= R; rep++) {
    const x = drawSample(h0, n, seed, rep);
    const p = pearsonTest(x, h0, opts);
    if (p.valid) { pearsonRuns++; if (p.reject) pearson++; }
    // Kolmogorov always against the fully specified H₀ law; with estimated parameters, against the fitted one (to show why that is invalid).
    const F = opts.estimate ? fittedCdf(x, h0) : LAWS[h0].cdf;
    if (kolmogorovStatistic(x, F).d >= crit) kolm++;
  }
  const half = R > 0 ? 3 * Math.sqrt((opts.alpha * (1 - opts.alpha)) / R) : 0;
  return {
    R, pearsonRate: pearsonRuns ? pearson / pearsonRuns : null, pearsonRuns,
    kolmogorovRate: R ? kolm / R : null, band: [Math.max(0, opts.alpha - half), opts.alpha + half],
  };
}
/** Maximum-likelihood fit from the raw sample (used only to show the Kolmogorov test with estimated parameters). */
function fittedCdf(x, law) {
  const { mean, m2 } = shapeMoments(x);
  const sd = Math.sqrt(m2);
  return LAWS[law].family.cdf(law === 0 ? [mean, sd] : law === 1 ? [Math.min(...x), Math.max(...x)] : [1 / mean]);
}

// ---------------------------------------------------------------- contract
const P = {
  law: { key: 'law', label: `True law (${lawLabel})`, min: 0, max: 2, step: 1, default: 0 },
  n: { key: 'n', label: 'Sample size n', min: 10, max: 1000, step: 10, default: 100 },
};
export const stations = {
  sample: {
    params: [
      P.law, P.n,
      { key: 'bins', label: 'Intervals k (0 = 5·lg n)', min: 0, max: 40, step: 1, default: 0 },
      { key: 'digits', label: 'Round values to d decimals (0 = no rounding)', min: 0, max: 3, step: 1, default: 0 },
      { key: 'view', label: 'View (0 histogram, 1 empirical CDF)', min: 0, max: 1, step: 1, default: 0 },
    ],
  },
  fit: {
    params: [
      P.law,
      { key: 'h0', label: `Hypothesis H₀ (${lawLabel})`, min: 0, max: 2, step: 1, default: 0 },
      { ...P.n, default: 200 },
      { key: 'alpha', label: 'Significance level α', min: 0.01, max: 0.2, step: 0.01, default: 0.05 },
      { key: 'cells', label: 'Pearson intervals s', min: 3, max: 30, step: 1, default: 10 },
      { key: 'estimate', label: 'Estimate H₀ parameters from the sample (0 no, 1 yes)', min: 0, max: 1, step: 1, default: 0 },
      { key: 'merge', label: 'Merge cells with expected count < 5 (0 no, 1 yes)', min: 0, max: 1, step: 1, default: 1 },
      { key: 'reps', label: 'Monte Carlo replicates under H₀', min: 0, max: 1000, step: 50, default: 300 },
    ],
  },
};
export const meta = {
  id: 'lecture-sampling-goodness-of-fit',
  lectures: ['L10', 'L12'],
  title: 'Sample description and goodness of fit: Kolmogorov and Pearson χ²',
  params: stations.sample.params,
};

const fmt = (v, d = 4) => (Number.isFinite(v) ? Number(v.toFixed(d)).toString() : String(v));
const grid = ([a, b], count = 200) => Array.from({ length: count + 1 }, (_, i) => a + ((b - a) * i) / count);

export function run(params, { seed, station } = {}) {
  return station === 'fit' ? runFit(params, seed) : runSample(params, seed);
}

function runSample({ law = 0, n = 100, bins = 0, digits = 0, view = 0 }, seed) {
  const L = LAWS[law];
  const sample = drawSample(law, n, seed).map((v) => roundTo(v, digits));
  const k = bins > 0 ? bins : defaultBinCount(n);
  const table = frequencyTable(sample, k);
  const vs = variationSeries(sample);
  const F = ecdf(sample);
  const mom = shapeMoments(sample);
  const lo = Math.min(L.range[0], vs.sorted[0]), hi = Math.max(L.range[1], vs.sorted[n - 1]);
  const xs = grid([lo, hi]);
  const series = view === 1
    ? [
      { id: 'cdf', kind: 'cdf', tone: 'signal', label: `F(x), ${L.label}`, x: xs, y: xs.map(L.cdf) },
      { id: 'ecdf', kind: 'ecdf', tone: 'default', label: 'Fₙ(x) = #{xᵢ ≤ x}/n', x: F.x, y: F.y },
    ]
    : [
      { id: 'hist', kind: 'hist', tone: 'default', label: `Histogram Hᵣ = Wᵣ/h, k = ${k}`, x: table.edges.slice(0, -1), y: table.height },
      { id: 'pdf', kind: 'pdf', tone: 'signal', label: `f(x), ${L.label}`, x: xs, y: xs.map(L.pdf) },
    ];
  const ties = vs.values.length < n;
  const rows = table.counts.map((m, r) => `[${fmt(table.edges[r], 3)}, ${fmt(table.edges[r + 1], 3)}${r === k - 1 ? ']' : ')'}: m = ${m}, W = ${fmt(table.freq[r])}, H = ${fmt(table.height[r])}`);
  const shown = vs.sorted.slice(0, 12).map((v) => fmt(v, 3)).join(' ≤ ');
  return {
    axes: view === 1 ? { x: 'x', y: 'distribution function' } : { x: 'x', y: 'density (Wᵣ/h)' },
    readouts: [
      { key: 'n', label: 'Sample size n = Σ mᵣ', observed: table.counts.reduce((s, m) => s + m, 0), theory: n },
      { key: 'k', label: 'Intervals k', observed: k, theory: defaultBinCount(n), convention: 'theory column: k ≈ 5·lg n (L10)' },
      { key: 'area', label: 'Histogram area Σ Hᵣ·h', observed: table.area, theory: 1 },
      { key: 'range', label: 'Range R = x_max − x_min', observed: vs.sorted[n - 1] - vs.sorted[0], theory: null },
      { key: 'distinct', label: 'Distinct values (ties if fewer than n)', observed: vs.values.length, theory: n },
      { key: 'mean', label: 'Sample mean x̄', observed: mom.mean, theory: L.mean },
      { key: 's2', label: 'Sample variance s² (divisor n − 1)', observed: mom.s2, theory: L.variance },
      { key: 'ecdf', label: 'Empirical CDF convention', observed: 'P(ξ ≤ x)', theory: null, convention: ECDF_CONVENTION },
    ],
    series,
    notes: [
      `Variation series (119), first ${Math.min(12, n)} of ${n}: ${shown}${n > 12 ? ' …' : ''}.`,
      `Interval table (Table 11), h = ${fmt(table.h)}: ${rows.join('; ')}.`,
      'Histogram (L10): bars of height Hᵣ = Wᵣ/h over each interval, so the total area is Σ Wᵣ = 1 and the histogram estimates the density.',
      `Number of intervals: L10 recommends k ≈ 5·lg n, which is ${defaultBinCount(n)} for n = ${n}. Change k to see how the picture depends on it.`,
      ties
        ? `Rounding to ${digits} decimals created ties: ${n - vs.values.length} repeated values. At a value that occurs m times Fₙ jumps by m/n in one step (Table 10).`
        : 'All values are distinct, so every step of Fₙ is 1/n. Round the values to create ties.',
      ECDF_CONVENTION,
    ],
  };
}

function runFit({ law = 0, h0 = 0, n = 200, alpha = 0.05, cells = 10, estimate = 0, merge = 1, reps = 300 }, seed) {
  const L = LAWS[law], H = LAWS[h0];
  const sample = drawSample(law, n, seed);
  const opts = { cells, alpha, estimate: estimate === 1, merge: merge === 1 };
  const pearson = pearsonTest(sample, h0, opts);
  const F0 = opts.estimate ? fittedCdf(sample, h0) : H.cdf;
  const kol = kolmogorovTest(sample, F0, alpha);
  const mom = shapeMoments(sample);
  const mc = falseRejection(h0, n, seed, reps, opts);
  const E = ecdf(sample);
  const lo = Math.min(L.range[0], H.range[0], E.x[0]), hi = Math.max(L.range[1], H.range[1], E.x[E.x.length - 1]);
  const xs = grid([lo, hi]);
  // Stepped band Fₙ ± λₙ(α): duplicate each jump point so the band edges are flat between observations.
  const bx = [lo], bl = [0], bu = [0];
  for (let i = 0; i < E.x.length; i++) { bx.push(E.x[i], E.x[i]); const prev = i ? E.y[i - 1] : 0; bl.push(prev, E.y[i]); bu.push(prev, E.y[i]); }
  bx.push(hi); bl.push(1); bu.push(1);
  const band = { id: 'band', kind: 'band', tone: 'muted', label: `Fₙ ± λₙ(α), λₙ = ${fmt(kol.critical)}`, x: bx, y: bl.map((v) => Math.max(0, v - kol.critical)), y2: bu.map((v) => Math.min(1, v + kol.critical)) };
  const ksValid = !opts.estimate;
  const se = {
    skew: Math.sqrt((6 * (n - 2)) / ((n + 1) * (n + 3))),
    kurt: Math.sqrt((24 * n * (n - 2) * (n - 3)) / ((n + 1) ** 2 * (n + 3) * (n + 5))),
  };
  const hLabel = opts.estimate ? `${H.family.label} fitted` : H.label;
  const decision = (rej) => (rej == null ? 'not applicable' : rej ? 'reject H₀' : 'do not reject H₀');
  const inBand = (v) => (v == null ? '' : v >= mc.band[0] && v <= mc.band[1] ? ' (inside the band)' : ' (outside the band)');
  return {
    axes: { x: 'x', y: 'distribution function' },
    readouts: [
      { key: 'dplus', label: 'Dₙ⁺ = max(i/n − F(x₍ᵢ₎))', observed: kol.dPlus, theory: null },
      { key: 'dminus', label: 'Dₙ⁻ = max(F(x₍ᵢ₎) − (i−1)/n)', observed: kol.dMinus, theory: null },
      { key: 'dn', label: 'Kolmogorov Dₙ = max(Dₙ⁺, Dₙ⁻)', observed: kol.d, theory: kol.critical, convention: `theory column: exact critical value λₙ(α) for n = ${n}; asymptotic λ/√n = ${fmt(kol.criticalAsymptotic)}` },
      { key: 'lambda', label: '√n·Dₙ', observed: kol.lambda, theory: kolmogorovQuantile(1 - alpha), convention: 'theory column: λ with K(λ) = 1 − α' },
      { key: 'ksp', label: 'Kolmogorov p-value', observed: ksValid ? kol.pExact : null, theory: ksValid ? kol.pAsymptotic : null, convention: ksValid ? 'observed: exact finite-n law; theory: 1 − K(√n·Dₙ)' : 'not valid with estimated parameters' },
      { key: 'ksdecision', label: 'Kolmogorov decision', observed: ksValid ? decision(kol.reject) : 'not applicable', theory: null },
      { key: 'chi2', label: 'Pearson χ² = Σ (mᵢ − npᵢ)²/(npᵢ)', observed: pearson.chi2, theory: pearson.critical, convention: `theory column: χ²₁₋α(k), k = s − 1 − r = ${pearson.s} − 1 − ${pearson.r} = ${pearson.df}` },
      { key: 'df', label: 'Degrees of freedom k = s − 1 − r', observed: pearson.df, theory: null },
      { key: 'chip', label: 'Pearson p-value', observed: pearson.p, theory: null },
      { key: 'chidecision', label: 'Pearson decision', observed: decision(pearson.reject), theory: null },
      { key: 'small', label: 'Cells with expected count < 5', observed: pearson.small, theory: 0, convention: opts.merge ? `${pearson.smallBefore} before merging` : 'merging is off' },
      { key: 'skew', label: 'Skewness a_s = m₃/σ³', observed: mom.skew, theory: L.skew, convention: `approximate standard error under normality ${fmt(se.skew)}` },
      { key: 'kurt', label: 'Excess kurtosis e_k = m₄/σ⁴ − 3', observed: mom.exKurt, theory: L.exKurt, convention: `approximate standard error under normality ${fmt(se.kurt)}` },
      { key: 'mcchi', label: `Pearson false-rejection rate under H₀ (${mc.pearsonRuns} runs)`, observed: mc.pearsonRate, theory: alpha, convention: `band α ± 3σ: [${fmt(mc.band[0])}, ${fmt(mc.band[1])}]${inBand(mc.pearsonRate)}` },
      { key: 'mcks', label: `Kolmogorov false-rejection rate under H₀ (${mc.R} runs)`, observed: mc.kolmogorovRate, theory: alpha, convention: `band [${fmt(mc.band[0])}, ${fmt(mc.band[1])}]${inBand(mc.kolmogorovRate)}${opts.estimate ? '; parameters re-estimated in every run' : ''}` },
    ],
    series: [
      band,
      { id: 'f0', kind: 'cdf', tone: 'signal', label: `H₀: F(x), ${hLabel}`, x: xs, y: xs.map(F0) },
      { id: 'ecdf', kind: 'ecdf', tone: 'default', label: `Fₙ(x), sample from ${L.label}`, x: E.x, y: E.y },
      { id: 'dmax', kind: 'rule', tone: 'accent', label: `Dₙ attained at x = ${fmt(kol.at, 3)}`, x: [kol.at], y: [] },
    ],
    notes: [
      `Kolmogorov (L10, L12): Dₙ = ${fmt(kol.d)} = max(D⁺ = ${fmt(kol.dPlus)}, D⁻ = ${fmt(kol.dMinus)}). H₀ is rejected when Dₙ ≥ λₙ(α), that is when the graph of F leaves the band Fₙ ± λₙ(α).`,
      ksValid
        ? 'The test needs a continuous F with every parameter known in advance. Here H₀ is fully specified.'
        : 'H₀ parameters were estimated from this sample. The Kolmogorov critical values then no longer hold: for the normal and exponential laws the test becomes far too lenient (compare the false-rejection rate with α). Use Pearson with r estimated parameters instead, and read its own false-rejection rate: the L12 midpoint estimates hold α only roughly.',
      `Pearson (L12): ${pearson.s} cells after ${opts.merge ? 'merging' : 'no merging'}, r = ${pearson.r} estimated parameter${pearson.r === 1 ? '' : 's'}${pearson.params ? ` (${pearson.params.map((v) => fmt(v)).join(', ')} from interval midpoints)` : ''}, k = s − 1 − r = ${pearson.df}. The outer cells are open to ±∞ so that Σ pᵢ = 1.`,
      pearson.warning ?? 'Every expected count is at least 5.',
      'L10 gives the degrees of freedom as "number of intervals − 1" and counts parameters from there. The general rule is the one in L12: k = s − 1 − r.',
      `Monte Carlo: ${mc.R} samples were drawn from H₀ itself (${H.label}) with the same seed and different streams. A correct level-α test rejects about α of them.${mc.R < reps ? ` Replicates were capped at ${mc.R} to keep n·R ≤ ${MC_BUDGET}.` : ''}`,
      'Skewness and excess kurtosis (L12): both are 0 for a normal law. Values far beyond about two standard errors argue against normality.',
    ],
  };
}

export default { meta, run, stations };
