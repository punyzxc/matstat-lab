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
    id: 'normal', label: 'Normal $N(1, 1)$', mean: 1, variance: 1, skew: 0, exKurt: 0,
    cdf: (x) => normalCdf(x - 1), pdf: (x) => normalPdf(x - 1),
    range: [1 - 4, 1 + 4],
    family: { r: 2, label: '$N(\\bar{x}, s^2)$', cdf: ([m, s]) => (x) => normalCdf((x - m) / s) },
  },
  {
    id: 'uniform', label: `Uniform $U(1 - \\sqrt{3},\\, 1 + \\sqrt{3})$`, mean: 1, variance: 1, skew: 0, exKurt: -1.2,
    cdf: (x) => Math.min(1, Math.max(0, (x - (1 - R3)) / (2 * R3))),
    pdf: (x) => (x >= 1 - R3 && x <= 1 + R3 ? 1 / (2 * R3) : 0),
    range: [1 - R3 - 0.5, 1 + R3 + 0.5],
    family: { r: 2, label: '$U(a^*, b^*)$', cdf: ([a, b]) => (x) => Math.min(1, Math.max(0, (x - a) / (b - a))) },
  },
  {
    id: 'exponential', label: 'Exponential $\\mathrm{Exp}(1)$', mean: 1, variance: 1, skew: 2, exKurt: 6,
    cdf: (x) => (x <= 0 ? 0 : -Math.expm1(-x)), pdf: (x) => (x < 0 ? 0 : Math.exp(-x)),
    range: [0, 7],
    family: { r: 1, label: '$\\mathrm{Exp}(\\lambda^*)$', cdf: ([l]) => (x) => (x <= 0 ? 0 : -Math.expm1(-l * x)) },
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
export const ECDF_CONVENTION = '$F_n(x) = \\#\\{x_i \\le x\\}/n$, right-continuous. The lecture (L5) defines $F(x) = P(\\xi < x)$; the two differ only at the jumps.';

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
/** Above this n·Dₙ the exact matrix (order 2⌈n·Dₙ⌉ − 1) is too slow for a slider; the p-value is then tiny and K is used. */
export const EXACT_ND_LIMIT = 40;
export function kolmogorovTest(sample, F, alpha, critical = kolmogorovCritical(sample.length, alpha)) {
  const n = sample.length;
  const stat = kolmogorovStatistic(sample, F);
  const lambda = Math.sqrt(n) * stat.d;
  return {
    ...stat, n, lambda, critical,
    criticalAsymptotic: kolmogorovQuantile(1 - alpha) / Math.sqrt(n),
    pExact: n * stat.d <= EXACT_ND_LIMIT ? 1 - kolmogorovExactCdf(n, stat.d) : null,
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
    warning: small > 0 ? `${small} cell${small === 1 ? '' : 's'} with expected count below 5: the $\\chi^2$ approximation is unreliable.` : null,
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
export function falseRejection(h0, n, seed, reps, opts, crit = kolmogorovCritical(n, opts.alpha)) {
  const R = Math.min(reps, Math.floor(MC_BUDGET / n));
  let pearson = 0, pearsonRuns = 0, kolm = 0;
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
    kolmogorovRate: R ? kolm / R : null, band: R ? [Math.max(0, opts.alpha - half), opts.alpha + half] : null,
  };
}
/** Maximum-likelihood fit from the raw sample (used only to show the Kolmogorov test with estimated parameters). */
function fittedCdf(x, law) {
  const { mean, m2 } = shapeMoments(x);
  const sd = Math.sqrt(m2);
  return LAWS[law].family.cdf(law === 0 ? [mean, sd] : law === 1 ? [Math.min(...x), Math.max(...x)] : [1 / mean]);
}

// ---------------------------------------------------------------- #127: the statistics drawn
/** The two ends of the largest gap at x₀: F(x₀) and the side of the jump of Fₙ* that is farther from it. */
export function gapEnds(sample, F, at) {
  let le = 0, lt = 0;
  for (const v of sample) { if (v <= at) le++; if (v < at) lt++; }
  const n = sample.length, f = F(at), upper = le / n, lower = lt / n;
  return Math.abs(upper - f) >= Math.abs(f - lower) ? [f, upper] : [f, lower];
}
/** Pearson cell by cell: each cell's term (mᵢ − npᵢ)²/npᵢ as a bar; the bars add up to χ². */
export function pearsonTerms(pearson) {
  return pearson.groups.map((g) => (g.expected > 0 ? (g.observed - g.expected) ** 2 / g.expected : g.observed > 0 ? Infinity : 0));
}
const cellTex = (g) => `(${Number.isFinite(g.from) ? fmt(g.from, 2) : '-\\infty'}, ${Number.isFinite(g.to) ? `${fmt(g.to, 2)}]` : '\\infty)'}`;
const texNum = (v, d) => (Number.isFinite(v) ? fmt(v, d) : '\\infty');
function pearsonView(pearson, n, alpha) {
  const terms = pearsonTerms(pearson), idx = terms.map((_, i) => i + 1);
  const shown = terms.length <= 7 ? terms.map((v) => texNum(v, 3)) : [...terms.slice(0, 4).map((v) => texNum(v, 3)), '\\dots', texNum(terms[terms.length - 1], 3)];
  // A cell with no expected count but an observation has an infinite term: drawn as the tallest bar, written as ∞.
  const finiteTop = Math.max(1, ...terms.filter(Number.isFinite));
  const heights = terms.map((v) => (Number.isFinite(v) ? v : 1.5 * finiteTop));
  let worst = 0;
  terms.forEach((v, i) => { if (v > terms[worst]) worst = i; });
  return {
    axes: { x: 'cell $i$', y: 'term $(m_i - np_i)^2 / np_i$' },
    domain: { x: [0.5, terms.length + 0.5] },
    series: [
      { id: 'terms', kind: 'hist', tone: 'default', label: `$\\dfrac{(m_i - np_i)^2}{np_i}$, sum $\\chi^2 = ${texNum(pearson.chi2, 3)}$`, x: idx.map((i) => i - 0.5), y: heights },
      { id: 'worst', kind: 'hist', tone: 'accent', label: `largest term: cell ${worst + 1}, $${cellTex(pearson.groups[worst])}$`, x: [worst + 0.5, worst + 1.5], y: [heights[worst], 0] },
    ],
    linked: {
      series: [
        { id: 'observed', kind: 'pmf', tone: 'default', label: 'observed $m_i$', x: idx.map((i) => i - 0.12), y: pearson.groups.map((g) => g.observed) },
        { id: 'expected', kind: 'pmf', tone: 'signal', label: 'expected $np_i$', x: idx.map((i) => i + 0.12), y: pearson.groups.map((g) => g.expected) },
      ],
      axes: { x: 'cell $i$', y: 'count' },
      domain: { x: [0.5, terms.length + 0.5] },
    },
    formula: [
      `\\chi^2 = \\sum_{i=1}^{${pearson.s}} \\dfrac{(m_i - np_i)^2}{np_i} = ${shown.join(' + ')} = ${texNum(pearson.chi2, 3)}`,
      pearson.valid
        ? `k = s - 1 - r = ${pearson.df}, \\quad \\chi^2_{1-\\alpha}(k) = ${fmt(pearson.critical, 3)}, \\quad p = ${fmt(pearson.p, 4)} \\;\\Rightarrow\\; \\text{${pearson.reject ? 'reject' : 'do not reject'} } H_0`
        : `k = s - 1 - r = ${pearson.df} < 1 \\;\\Rightarrow\\; \\text{the test cannot run}`,
    ],
  };
}

// ---------------------------------------------------------------- #126: representativeness
// A random sample takes every member of the population with the same chance; a biased one takes them only from a
// region [lo, hi] (a survey in one district). The biased one is a sample of the law of ξ given lo ≤ ξ ≤ hi: its
// mean settles at E(ξ | lo ≤ ξ ≤ hi), not at a, however large n is.
const SUPPORT = [[-Infinity, Infinity], [1 - R3, 1 + R3], [0, Infinity]];
/**
 * Φ⁻¹(p) by Acklam's rational approximation (relative error below 1.2·10⁻⁹): the error curve draws tens of
 * thousands of points, and the Newton-refined normalQuantile would cost ten times more for digits no picture shows.
 */
const AC = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
const AD = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const AE = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const AF = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
export function fastNormalQuantile(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const tail = (q) => (((((AE[0] * q + AE[1]) * q + AE[2]) * q + AE[3]) * q + AE[4]) * q + AE[5]) / ((((AF[0] * q + AF[1]) * q + AF[2]) * q + AF[3]) * q + 1);
  if (p < 0.02425) return tail(Math.sqrt(-2 * Math.log(p)));
  if (p > 1 - 0.02425) return -tail(Math.sqrt(-2 * Math.log1p(-p)));
  const q = p - 0.5, r = q * q;
  return ((((((AC[0] * r + AC[1]) * r + AC[2]) * r + AC[3]) * r + AC[4]) * r + AC[5]) * q) / (((((AD[0] * r + AD[1]) * r + AD[2]) * r + AD[3]) * r + AD[4]) * r + 1);
}
/** F⁻¹(p) of LAWS[law]. */
export function quantile(law, p) {
  if (law === 0) return 1 + fastNormalQuantile(p);
  if (law === 1) return 1 - R3 + 2 * R3 * p;
  return -Math.log1p(-p);
}
/** The law of ξ given lo ≤ ξ ≤ hi: its probability, mean and variance (Simpson on the support, 4000 intervals). */
export function truncatedMoments(law, lo, hi) {
  const L = LAWS[law], [s0, s1] = SUPPORT[law];
  const a = Math.max(lo, s0), b = Math.min(hi, s1);
  const mass = b > a ? L.cdf(b) - L.cdf(a) : 0;
  if (!(mass > 0)) return { mass: 0, mean: NaN, variance: NaN };
  const N = 4000, h = (b - a) / N;
  let m1 = 0, m2 = 0;
  for (let i = 0; i <= N; i++) {
    const x = a + i * h, w = (i === 0 || i === N ? 1 : i % 2 ? 4 : 2) * L.pdf(x);
    m1 += w * x;
    m2 += w * x * x;
  }
  m1 *= h / 3 / mass;
  m2 *= h / 3 / mass;
  return { mass, mean: m1, variance: m2 - m1 * m1 };
}
/** n draws from LAWS[law] given lo ≤ ξ ≤ hi, by the inverse transform on [F(lo), F(hi)]; `at(i)` gives the i-th uniform. */
function drawWindow(law, n, lo, hi, at) {
  const L = LAWS[law], f0 = Number.isFinite(lo) ? L.cdf(lo) : 0, f1 = Number.isFinite(hi) ? L.cdf(hi) : 1;
  const x = new Array(n);
  for (let i = 0; i < n; i++) x[i] = Math.min(hi, Math.max(lo, quantile(law, f0 + (f1 - f0) * at(i))));
  return x;
}
/** The biased sample of the station: n members taken only from [lo, hi], stream 1. */
export const biasedSample = (law, n, lo, hi, seed) => drawWindow(law, n, lo, hi, (i) => unit(seed, 1, i));
export const ERROR_NS = [10, 20, 50, 100, 200, 500, 1000];
/**
 * Mean error |x̄ − a| over `reps` repeated samples at each n of ERROR_NS, for the random and the biased sampler
 * (streams 2 and 3; sample r at size index j uses indices (j·reps + r)·1000 + i).
 */
export function errorCurve(law, lo, hi, reps, seed) {
  const a = LAWS[law].mean;
  const curve = (stream, l, h) => ERROR_NS.map((n, j) => {
    let total = 0;
    for (let r = 0; r < reps; r++) {
      const base = (j * reps + r) * 1000;
      const x = drawWindow(law, n, l, h, (i) => unit(seed, stream, base + i));
      total += Math.abs(x.reduce((s, v) => s + v, 0) / n - a);
    }
    return total / reps;
  });
  return { ns: ERROR_NS, random: curve(2, -Infinity, Infinity), biased: curve(3, lo, hi) };
}
/** Histogram heights W_r/h of `sample` on the given edges (values outside count in no bar). */
function heightsOn(sample, edges) {
  const k = edges.length - 1, h = edges[1] - edges[0], c = new Array(k).fill(0);
  for (const v of sample) {
    const r = Math.min(k - 1, Math.floor((v - edges[0]) / h));
    if (r >= 0 && v <= edges[k]) c[r]++;
  }
  return c.map((m) => m / sample.length / h);
}

function runRepresentative({ law = 0, n = 100, bins = 0, lo: lo0 = 1.5, hi: hi0 = 4, reps = 100 }, seed) {
  const L = LAWS[law];
  const lo = Math.min(lo0, hi0), hi = Math.max(lo0, hi0);
  const T = truncatedMoments(law, lo, hi);
  if (!(T.mass > 1e-6)) throw new Error('The region holds almost none of the population: widen it.');
  const random = drawSample(law, n, seed), biased = biasedSample(law, n, lo, hi, seed);
  const mr = shapeMoments(random), mb = shapeMoments(biased);
  const k = bins > 0 ? bins : defaultBinCount(n);
  const all = [...random, ...biased];
  let x0 = Math.min(...all), x1 = Math.max(...all);
  if (x1 === x0) { x0 -= 0.5; x1 += 0.5; }
  const h = (x1 - x0) / k, edges = Array.from({ length: k + 1 }, (_, r) => (r === k ? x1 : x0 + r * h));
  const hr = heightsOn(random, edges), hb = heightsOn(biased, edges);
  const xs = grid([Math.min(L.range[0], x0), Math.max(L.range[1], x1)]);
  const top = Math.max(...xs.map(L.pdf), ...hr, ...hb) * 1.05;
  // The biased histogram as an outline over the same bars, closed down to the axis at both ends.
  const stepX = edges.flatMap((e) => [e, e]);
  const stepY = [0, ...hb.flatMap((v) => [v, v]), 0];
  const E = errorCurve(law, lo, hi, reps, seed), lx = E.ns.map((v) => Math.log10(v));
  const bias = T.mean - L.mean, sd = Math.sqrt(L.variance);
  const f4 = (v) => fmt(v, 4), f3 = (v) => fmt(v, 3);
  const region = `${f3(lo)} \\le \\xi \\le ${f3(hi)}`;
  return {
    axes: { x: '$x$', y: 'density ($W_r/h$)' },
    domain: { y: [0, top] },
    readouts: [
      { key: 'meanR', label: 'Random sample: mean $\\bar{x}$', observed: mr.mean, theory: L.mean, convention: 'theory: $a = M\\xi$' },
      { key: 'meanB', label: 'Biased sample: mean $\\bar{x}$', observed: mb.mean, theory: L.mean,
        convention: `it settles at $M(\\xi \\mid ${region}) = ${f4(T.mean)}$ instead` },
      { key: 's2R', label: 'Random sample: variance $s^2$', observed: mr.s2, theory: L.variance, convention: 'theory: $\\sigma^2 = D\\xi$' },
      { key: 's2B', label: 'Biased sample: variance $s^2$', observed: mb.s2, theory: L.variance,
        convention: `it settles at $D(\\xi \\mid ${region}) = ${f4(T.variance)}$ instead` },
      { key: 'mass', label: 'Share of the population in the region', observed: null, theory: T.mass },
      { key: 'errR', label: `Random: mean error $|\\bar{x} - a|$ at $n = 1000$`, observed: E.random.at(-1), theory: sd * Math.sqrt(2 / Math.PI / 1000),
        convention: 'theory: $\\sigma\\sqrt{2/(\\pi n)}$, falls as $1/\\sqrt{n}$' },
      { key: 'errB', label: `Biased: mean error $|\\bar{x} - a|$ at $n = 1000$`, observed: E.biased.at(-1), theory: Math.abs(bias),
        convention: 'theory: the bias $|M(\\xi \\mid \\text{region}) - a|$, it does not fall' },
    ],
    series: [
      { id: 'region', kind: 'band', tone: 'muted', label: `region of the biased sampler: $${region}$`, x: [lo, hi], y: [0, 0], y2: [top, top] },
      { id: 'hist', kind: 'hist', tone: 'default', label: `random sample, $n = ${n}$`, x: edges.slice(0, -1), y: hr },
      { id: 'biased', kind: 'line', tone: 'accent', label: `biased sample, $n = ${n}$`, x: stepX, y: stepY },
      { id: 'pdf', kind: 'pdf', tone: 'signal', label: `$f(x)$ of the population, ${L.label}`, x: xs, y: xs.map(L.pdf) },
      { id: 'a', kind: 'rule', tone: 'default', label: `$a = M\\xi = ${f4(L.mean)}$`, x: [L.mean], y: [] },
      { id: 'meanB', kind: 'rule', tone: 'accent', label: `$\\bar{x}$ of the biased sample`, x: [mb.mean], y: [] },
    ],
    linked: {
      series: [
        { id: 'theoryR', kind: 'line', tone: 'signal', label: '$\\sigma\\sqrt{2/(\\pi n)}$', x: lx, y: E.ns.map((v) => sd * Math.sqrt(2 / Math.PI / v)) },
        { id: 'bias', kind: 'line', tone: 'muted', label: `bias $|M(\\xi \\mid \\text{region}) - a| = ${f4(Math.abs(bias))}$`, x: [lx[0], lx.at(-1)], y: [Math.abs(bias), Math.abs(bias)] },
        { id: 'errR', kind: 'points', tone: 'default', marker: 'dot', label: `random sampler, mean of ${reps} samples`, x: lx, y: E.random },
        { id: 'errB', kind: 'points', tone: 'accent', marker: 'dot', label: `biased sampler, mean of ${reps} samples`, x: lx, y: E.biased },
      ],
      axes: { x: '$\\lg n$', y: 'mean error $|\\bar{x} - a|$' },
      domain: { x: [0.9, 3.1] },
    },
    formula: [
      `\\bar{x}_{\\text{random}} = ${f4(mr.mean)} \\approx a = ${f4(L.mean)}, \\qquad \\bar{x}_{\\text{biased}} = ${f4(mb.mean)} \\approx M(\\xi \\mid ${region}) = ${f4(T.mean)}`,
      `s^2_{\\text{random}} = ${f4(mr.s2)} \\approx \\sigma^2 = ${f4(L.variance)}, \\qquad s^2_{\\text{biased}} = ${f4(mb.s2)} \\approx D(\\xi \\mid ${region}) = ${f4(T.variance)}`,
    ],
    notes: [
      'Representativeness (L10): a sample describes the population only if every member had the same chance to enter it. The random sampler does that; the biased one takes members only from the shaded region.',
      `The biased sample is a sample of the law of $\\xi$ given $${region}$: its histogram copies $f(x)$ cut to the region and renormalised, and its mean settles at $${f4(T.mean)}$, not at $a = ${f4(L.mean)}$.`,
      'Lower chart: the mean error over repeated samples. The random one falls as $1/\\sqrt{n}$; the biased one stops at the bias. A larger biased sample is only more sure of the wrong answer.',
    ],
  };
}

// ---------------------------------------------------------------- contract
const P = {
  law: { key: 'law', label: `True law (${lawLabel})`, min: 0, max: 2, step: 1, default: 0 },
  n: { key: 'n', label: 'Sample size $n$', min: 10, max: 1000, step: 10, default: 100 },
};
export const stations = {
  sample: {
    params: [
      P.law, P.n,
      { key: 'bins', label: 'Intervals $k$ ($0 = 5 \\lg n$)', min: 0, max: 40, step: 1, default: 0 },
      { key: 'digits', label: 'Round values to $d$ decimals (0 = no rounding)', min: 0, max: 3, step: 1, default: 0 },
      { key: 'view', label: 'View (0 histogram, 1 empirical CDF, 2 random against biased)', min: 0, max: 2, step: 1, default: 0 },
      { key: 'lo', label: 'Biased sampler region: left end $x_1$', min: -3, max: 7, step: 0.1, default: 1.5, when: { view: [2] } },
      { key: 'hi', label: 'Biased sampler region: right end $x_2$', min: -3, max: 7, step: 0.1, default: 4, when: { view: [2] } },
      { key: 'reps', label: 'Repeated samples per $n$ for the error curve', min: 20, max: 400, step: 10, default: 100, when: { view: [2] } },
    ],
  },
  fit: {
    params: [
      { key: 'view', label: 'Show (0 Kolmogorov: the largest gap, 1 Pearson: cell by cell)', min: 0, max: 1, step: 1, default: 0 },
      P.law,
      { key: 'h0', label: `Hypothesis $H_0$ (${lawLabel})`, min: 0, max: 2, step: 1, default: 0 },
      { ...P.n, default: 200 },
      { key: 'alpha', label: 'Significance level $\\alpha$', min: 0.01, max: 0.2, step: 0.01, default: 0.05 },
      { key: 'cells', label: 'Pearson intervals $s$', min: 3, max: 30, step: 1, default: 10 },
      { key: 'estimate', label: 'Estimate $H_0$ parameters from the sample (0 no, 1 yes)', min: 0, max: 1, step: 1, default: 0 },
      { key: 'merge', label: 'Merge cells with expected count < 5 (0 no, 1 yes)', min: 0, max: 1, step: 1, default: 1 },
      { key: 'reps', label: 'Monte Carlo replicates under $H_0$', min: 0, max: 1000, step: 50, default: 300 },
    ],
  },
};
export const meta = {
  id: 'lecture-sampling-goodness-of-fit',
  lectures: ['L10', 'L12'],
  title: 'Sample description and goodness of fit: Kolmogorov and Pearson $\\chi^2$',
  params: stations.sample.params,
};

const fmt = (v, d = 4) => (Number.isFinite(v) ? Number(v.toFixed(d)).toString() : String(v));
const grid = ([a, b], count = 200) => Array.from({ length: count + 1 }, (_, i) => a + ((b - a) * i) / count);

export function run(params, { seed, station } = {}) {
  return station === 'fit' ? runFit(params, seed) : runSample(params, seed);
}

function runSample({ law = 0, n = 100, bins = 0, digits = 0, view = 0, ...rest }, seed) {
  if (view === 2) return runRepresentative({ law, n, bins, lo: rest.lo, hi: rest.hi, reps: rest.reps }, seed);
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
      { id: 'cdf', kind: 'cdf', tone: 'signal', label: `$F(x)$, ${L.label}`, x: xs, y: xs.map(L.cdf) },
      { id: 'ecdf', kind: 'ecdf', tone: 'default', label: '$F_n(x) = \\#\\{x_i \\le x\\}/n$', x: F.x, y: F.y },
    ]
    : [
      { id: 'hist', kind: 'hist', tone: 'default', label: `Histogram $H_r = W_r/h$, $k = ${k}$`, x: table.edges.slice(0, -1), y: table.height },
      { id: 'pdf', kind: 'pdf', tone: 'signal', label: `$f(x)$, ${L.label}`, x: xs, y: xs.map(L.pdf) },
    ];
  const ties = vs.values.length < n;
  const rows = table.counts.map((m, r) => `[${fmt(table.edges[r], 3)}, ${fmt(table.edges[r + 1], 3)}${r === k - 1 ? ']' : ')'}: m = ${m}, W = ${fmt(table.freq[r])}, H = ${fmt(table.height[r])}`);
  const shown = vs.sorted.slice(0, 12).map((v) => fmt(v, 3)).join(' \\le ');
  return {
    axes: view === 1 ? { x: '$x$', y: 'distribution function' } : { x: '$x$', y: 'density ($W_r/h$)' },
    readouts: [
      { key: 'n', label: 'Sample size $n = \\sum_r m_r$', observed: table.counts.reduce((s, m) => s + m, 0), theory: n },
      { key: 'k', label: 'Intervals $k$', observed: k, theory: defaultBinCount(n), convention: 'theory column: $k \\approx 5 \\lg n$ (L10)' },
      { key: 'area', label: 'Histogram area $\\sum_r H_r h$', observed: table.area, theory: 1 },
      { key: 'range', label: 'Range $R = x_{\\max} - x_{\\min}$', observed: vs.sorted[n - 1] - vs.sorted[0], theory: null },
      { key: 'distinct', label: 'Distinct values (ties if fewer than $n$)', observed: vs.values.length, theory: n },
      { key: 'mean', label: 'Sample mean $\\bar{x}$', observed: mom.mean, theory: L.mean },
      { key: 's2', label: 'Sample variance $s^2$ (divisor $n - 1$)', observed: mom.s2, theory: L.variance },
      { key: 'ecdf', label: 'Empirical CDF convention', observed: '$P(\\xi \\le x)$', theory: null, convention: ECDF_CONVENTION },
    ],
    series,
    notes: [
      `Variation series (119), first ${Math.min(12, n)} of ${n}: $${shown}${n > 12 ? ' \\le \\ldots' : ''}$.`,
      `Interval table (Table 11), $h = ${fmt(table.h)}$: ${rows.join('; ')}.`,
      'Histogram (L10): bars of height $H_r = W_r/h$ over each interval, so the total area is $\\sum_r W_r = 1$ and the histogram estimates the density.',
      `Number of intervals: L10 recommends $k \\approx 5 \\lg n$, which is ${defaultBinCount(n)} for $n = ${n}$. Change $k$ to see how the picture depends on it.`,
      ties
        ? `Rounding to ${digits} decimals created ties: ${n - vs.values.length} repeated values. At a value that occurs $m$ times $F_n$ jumps by $m/n$ in one step (Table 10).`
        : 'All values are distinct, so every step of $F_n$ is $1/n$. Round the values to create ties.',
      ECDF_CONVENTION,
    ],
  };
}

function runFit({ view = 0, law = 0, h0 = 0, n = 200, alpha = 0.05, cells = 10, estimate = 0, merge = 1, reps = 300 }, seed) {
  const L = LAWS[law], H = LAWS[h0];
  const sample = drawSample(law, n, seed);
  const opts = { cells, alpha, estimate: estimate === 1, merge: merge === 1 };
  const pearson = pearsonTest(sample, h0, opts);
  const F0 = opts.estimate ? fittedCdf(sample, h0) : H.cdf;
  const critical = kolmogorovCritical(n, alpha);
  const kol = kolmogorovTest(sample, F0, alpha, critical);
  const mom = shapeMoments(sample);
  const mc = falseRejection(h0, n, seed, reps, opts, critical);
  const E = ecdf(sample);
  const lo = Math.min(L.range[0], H.range[0], E.x[0]), hi = Math.max(L.range[1], H.range[1], E.x[E.x.length - 1]);
  const xs = grid([lo, hi]);
  // Stepped band Fₙ ± λₙ(α): duplicate each jump point so the band edges are flat between observations.
  const bx = [lo], bl = [0], bu = [0];
  for (let i = 0; i < E.x.length; i++) { bx.push(E.x[i], E.x[i]); const prev = i ? E.y[i - 1] : 0; bl.push(prev, E.y[i]); bu.push(prev, E.y[i]); }
  bx.push(hi); bl.push(1); bu.push(1);
  const band = { id: 'band', kind: 'band', tone: 'muted', label: `$F_n \\pm \\lambda_n(\\alpha)$, $\\lambda_n = ${fmt(kol.critical)}$`, x: bx, y: bl.map((v) => Math.max(0, v - kol.critical)), y2: bu.map((v) => Math.min(1, v + kol.critical)) };
  const ksValid = !opts.estimate;
  const se = {
    skew: Math.sqrt((6 * (n - 2)) / ((n + 1) * (n + 3))),
    kurt: Math.sqrt((24 * n * (n - 2) * (n - 3)) / ((n + 1) ** 2 * (n + 3) * (n + 5))),
  };
  const hLabel = opts.estimate ? `${H.family.label} fitted` : H.label;
  const decision = (rej) => (rej == null ? 'not applicable' : rej ? 'reject $H_0$' : 'do not reject $H_0$');
  const inBand = (v) => (v == null || !mc.band ? '' : v >= mc.band[0] && v <= mc.band[1] ? ' (inside the band)' : ' (outside the band)');
  const bandText = mc.band ? `band $\\alpha \\pm 3\\sigma$: $[${fmt(mc.band[0])}, ${fmt(mc.band[1])}]$` : 'no replicates: move the replicate slider above 0';
  return {
    axes: { x: '$x$', y: 'distribution function' },
    readouts: [
      { key: 'dplus', label: '$D_n^+ = \\max_i \\bigl(i/n - F(x_{(i)})\\bigr)$', observed: kol.dPlus, theory: null },
      { key: 'dminus', label: '$D_n^- = \\max_i \\bigl(F(x_{(i)}) - (i-1)/n\\bigr)$', observed: kol.dMinus, theory: null },
      { key: 'dn', label: 'Kolmogorov $D_n = \\max(D_n^+, D_n^-)$', observed: kol.d, theory: kol.critical, convention: `theory column: exact critical value $\\lambda_n(\\alpha)$ for $n = ${n}$; asymptotic $\\lambda/\\sqrt{n} = ${fmt(kol.criticalAsymptotic)}$` },
      { key: 'lambda', label: '$\\sqrt{n}\\, D_n$', observed: kol.lambda, theory: kolmogorovQuantile(1 - alpha), convention: 'theory column: $\\lambda$ with $K(\\lambda) = 1 - \\alpha$' },
      { key: 'ksp', label: 'Kolmogorov $p$-value', observed: ksValid ? kol.pExact ?? kol.pAsymptotic : null, theory: ksValid ? kol.pAsymptotic : null, convention: !ksValid ? 'not valid with estimated parameters' : kol.pExact == null ? `$n D_n > ${EXACT_ND_LIMIT}$: both columns use $1 - K(\\sqrt{n}\\, D_n)$; the $p$-value is tiny` : 'observed: exact finite-$n$ law; theory: $1 - K(\\sqrt{n}\\, D_n)$' },
      { key: 'ksdecision', label: 'Kolmogorov decision', observed: ksValid ? decision(kol.reject) : 'not applicable', theory: null },
      { key: 'chi2', label: 'Pearson $\\chi^2 = \\sum_i \\dfrac{(m_i - np_i)^2}{np_i}$', observed: pearson.chi2, theory: pearson.critical, convention: `theory column: $\\chi^2_{1-\\alpha}(k)$, $k = s - 1 - r = ${pearson.s} - 1 - ${pearson.r} = ${pearson.df}$` },
      { key: 'df', label: 'Degrees of freedom $k = s - 1 - r$', observed: pearson.df, theory: null },
      { key: 'chip', label: 'Pearson $p$-value', observed: pearson.p, theory: null },
      { key: 'chidecision', label: 'Pearson decision', observed: decision(pearson.reject), theory: null },
      { key: 'small', label: 'Cells with expected count $< 5$', observed: pearson.small, theory: 0, convention: opts.merge ? `${pearson.smallBefore} before merging` : 'merging is off' },
      { key: 'skew', label: 'Skewness $a_s = m_3/\\sigma^3$', observed: mom.skew, theory: L.skew, convention: `approximate standard error under normality ${fmt(se.skew)}` },
      { key: 'kurt', label: 'Excess kurtosis $e_k = m_4/\\sigma^4 - 3$', observed: mom.exKurt, theory: L.exKurt, convention: `approximate standard error under normality ${fmt(se.kurt)}` },
      { key: 'mcchi', label: `Pearson false-rejection rate under $H_0$ (${mc.pearsonRuns} runs)`, observed: mc.pearsonRate, theory: alpha, convention: `${bandText}${inBand(mc.pearsonRate)}` },
      { key: 'mcks', label: `Kolmogorov false-rejection rate under $H_0$ (${mc.R} runs)`, observed: mc.kolmogorovRate, theory: alpha, convention: `${bandText}${inBand(mc.kolmogorovRate)}${opts.estimate ? '; parameters re-estimated in every run' : ''}` },
    ],
    ...(view === 1 ? pearsonView(pearson, n, alpha) : {
      series: [
        band,
        { id: 'f0', kind: 'cdf', tone: 'signal', label: `$H_0$: $F(x)$, ${hLabel}`, x: xs, y: xs.map(F0) },
        { id: 'ecdf', kind: 'ecdf', tone: 'default', label: `$F_n(x)$, sample from ${L.label}`, x: E.x, y: E.y },
        { id: 'gap', kind: 'line', tone: 'accent', label: `$D_n = ${fmt(kol.d)}$ at $x_0 = ${fmt(kol.at, 3)}$`, x: [kol.at, kol.at], y: gapEnds(sample, F0, kol.at) },
        { id: 'gapEnds', kind: 'points', tone: 'accent', x: [kol.at, kol.at], y: gapEnds(sample, F0, kol.at) },
      ],
      formula: [
        `D_n = \\sup_x \\bigl|F_n^*(x) - F(x)\\bigr| = \\bigl|F_n^*(${fmt(kol.at, 3)}) - F(${fmt(kol.at, 3)})\\bigr| = ${fmt(kol.d)}`,
        `\\lambda_n(\\alpha) = ${fmt(kol.critical)}, \\quad D_n ${kol.d >= kol.critical ? '\\ge' : '<'} \\lambda_n(\\alpha) \\;\\Rightarrow\\; \\text{${kol.d >= kol.critical ? 'reject' : 'do not reject'} } H_0`,
      ],
    }),
    notes: [
      `Kolmogorov (L10, L12): $D_n = ${fmt(kol.d)} = \\max(D^+ = ${fmt(kol.dPlus)},\\ D^- = ${fmt(kol.dMinus)})$. $H_0$ is rejected when $D_n \\ge \\lambda_n(\\alpha)$, that is when the graph of $F$ leaves the band $F_n \\pm \\lambda_n(\\alpha)$.`,
      ksValid
        ? 'The test needs a continuous $F$ with every parameter known in advance. Here $H_0$ is fully specified.'
        : '$H_0$ parameters were estimated from this sample. The Kolmogorov critical values then no longer hold: for the normal and exponential laws the test becomes far too lenient (compare the false-rejection rate with $\\alpha$). Use Pearson with $r$ estimated parameters instead, and read its own false-rejection rate: the L12 midpoint estimates hold $\\alpha$ only roughly.',
      `Pearson (L12): ${pearson.s} cells after ${opts.merge ? 'merging' : 'no merging'}, $r = ${pearson.r}$ estimated parameter${pearson.r === 1 ? '' : 's'}${pearson.params ? ` (${pearson.params.map((v) => fmt(v)).join(', ')} from interval midpoints)` : ''}, $k = s - 1 - r = ${pearson.df}$. The outer cells are open to $\\pm\\infty$ so that $\\sum_i p_i = 1$.`,
      pearson.valid
        ? pearson.warning ?? 'Every expected count is at least 5.'
        : `Too few cells: $k = s - 1 - r = ${pearson.s} - 1 - ${pearson.r} = ${pearson.df} < 1$, so the $\\chi^2$ test cannot run. Increase $s$${opts.merge ? ' or $n$ (merging joined cells)' : ''}.`,
      'L10 gives the degrees of freedom as "number of intervals − 1" and counts parameters from there. The general rule is the one in L12: $k = s - 1 - r$.',
      `Monte Carlo: ${mc.R} samples were drawn from $H_0$ itself (${H.label}) with the same seed and different streams. A correct level-$\\alpha$ test rejects about $\\alpha$ of them.${mc.R < reps ? ` Replicates were capped at ${mc.R} to keep $nR \\le ${MC_BUDGET}$.` : ''}`,
      'Skewness and excess kurtosis (L12): both are 0 for a normal law. Values far beyond about two standard errors argue against normality.',
    ],
  };
}

export default { meta, run, stations };
