// Throwaway Discovery spike for issue #46 (lecture 11). Not product code.
// One kernel, three stations: Estimation (point estimates), Confidence Intervals
// (normal-approximation, Student t and χ² intervals with their coverage) and
// Homogeneity (the two-series test, formula 139). Contract: docs/research/lecture-module-map.md.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import { normalCdf, normalQuantile, studentTQuantile as tQ, chiSquareQuantile as chiQ, logGamma } from './special.mjs';

// Quantiles depend only on (p, df); a coverage run asks for the same ones thousands of times.
const memo = (f) => { const cache = new Map(); return (p, df) => { const k = p + '|' + df; let v = cache.get(k); if (v === undefined) cache.set(k, v = f(p, df)); return v; }; };
const studentTQuantile = memo(tQ), chiSquareQuantile = memo(chiQ);

// ---------------------------------------------------------------- randomness
const NAMESPACE = 0x4611; // keeps these streams apart from other kernels that share a seed
const STRIDE = 4096; // index = replicate · STRIDE + i, so n ≤ STRIDE
/** Uniform on (0, 1), never 0 or 1. */
const uniform = (seed, stream, index) => (fixtureUint32(seed, stream, index, NAMESPACE) + 0.5) / 2 ** 32;

/** The two laws of the lab. Both have mean mu and standard deviation sigma. */
export const LAWS = Object.freeze([
  { id: 'normal', label: 'Normal $N(\\mu, \\sigma^2)$', kurtosis: 0 },
  { id: 'exponential', label: 'Shifted exponential (skewed, same $\\mu$ and $\\sigma$)', kurtosis: 6 },
]);
function draw(law, mu, sigma, u) {
  return law === 1 ? mu + sigma * (-Math.log1p(-u) - 1) : mu + sigma * normalQuantile(u);
}
/** Replicate r of a sample of size n, from a given stream. */
export function sampleOf({ law, mu, sigma, n, seed, stream, r }) {
  if (n > STRIDE) throw new RangeError(`n must be at most ${STRIDE}`);
  const x = new Array(n);
  for (let i = 0; i < n; i++) x[i] = draw(law, mu, sigma, uniform(seed, stream, r * STRIDE + i));
  return x;
}

// ---------------------------------------------------------------- point estimates (L11 formulas 123–126)
export const mean = (x) => x.reduce((s, v) => s + v, 0) / x.length;
export function sumSquares(x) {
  const m = mean(x);
  return x.reduce((s, v) => s + (v - m) ** 2, 0);
}
/** divisor 'n' (sample variance, formula 124) or 'n-1' (corrected variance, formula 126). */
export function variance(x, divisor) {
  const n = x.length;
  if (divisor === 'n') return sumSquares(x) / n;
  if (divisor === 'n-1') return n >= 2 ? sumSquares(x) / (n - 1) : NaN;
  throw new RangeError('divisor must be n or n-1');
}
export function median(x) {
  const s = [...x].sort((a, b) => a - b), k = s.length >> 1;
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}
/**
 * Exact moments for i.i.d. data with variance σ² and excess kurtosis κ:
 * Var(s²) = σ⁴(2/(n − 1) + κ/n); the divisor-n estimator is ((n − 1)/n)·s².
 */
export function oracles(n, sigma2, kappa = 0) {
  const varS2 = sigma2 ** 2 * (2 / (n - 1) + kappa / n), c = (n - 1) / n;
  return {
    mean: { bias: 0, variance: sigma2 / n, mse: sigma2 / n },
    'var-n-1': { bias: 0, variance: varS2, mse: varS2 },
    'var-n': { bias: -sigma2 / n, variance: c * c * varS2, mse: c * c * varS2 + (sigma2 / n) ** 2 },
  };
}

// ---------------------------------------------------------------- intervals (L11 formulas 128–138)
const zOf = (gamma) => normalQuantile((1 + gamma) / 2);
/** Formula 129/131: x̄ ± t_γ·√(s²/n), t_γ = Φ⁻¹((1 + γ)/2), s² corrected. Approximate (CLT, n > 20). */
export function approxMeanInterval(x, gamma) {
  const n = x.length, m = mean(x), s2 = variance(x, 'n-1'), q = zOf(gamma), half = q * Math.sqrt(s2 / n);
  return { method: 'approx-mean', lower: m - half, upper: m + half, estimate: m, critical: q };
}
/** Formula 130/132: s² ± t_γ·σ_{s²}, σ_{s²} = √(2/(n − 1))·s². Approximate. */
export function approxVarianceInterval(x, gamma) {
  const n = x.length, s2 = variance(x, 'n-1'), q = zOf(gamma), half = q * Math.sqrt(2 / (n - 1)) * s2;
  return { method: 'approx-variance', lower: s2 - half, upper: s2 + half, estimate: s2, critical: q };
}
/** Formula 136: x̄ ± t_{(1+γ)/2, n−1}·s/√n. Exact for normal data. */
export function tMeanInterval(x, gamma) {
  const n = x.length, m = mean(x), s2 = variance(x, 'n-1'), q = studentTQuantile((1 + gamma) / 2, n - 1), half = q * Math.sqrt(s2 / n);
  return { method: 't-mean', lower: m - half, upper: m + half, estimate: m, critical: q, df: n - 1 };
}
/** Formula 138: (n − 1)s²/χ²_{(1+γ)/2} < D < (n − 1)s²/χ²_{(1−γ)/2}, df = n − 1. Exact for normal data. */
export function chiSquareVarianceInterval(x, gamma) {
  const n = x.length, s2 = variance(x, 'n-1');
  const hiQ = chiSquareQuantile((1 + gamma) / 2, n - 1), loQ = chiSquareQuantile((1 - gamma) / 2, n - 1);
  return { method: 'chi2-variance', lower: (n - 1) * s2 / hiQ, upper: (n - 1) * s2 / loQ, estimate: s2, critical: [loQ, hiQ], df: n - 1 };
}
export const METHODS = Object.freeze({
  mean: [{ id: 'approx-mean', label: 'Normal approximation (129)', build: approxMeanInterval, tone: 'accent' },
    { id: 't-mean', label: 'Student $t$ (136)', build: tMeanInterval, tone: 'default' }],
  variance: [{ id: 'approx-variance', label: 'Normal approximation (130)', build: approxVarianceInterval, tone: 'accent' },
    { id: 'chi2-variance', label: '$\\chi^2$ (138)', build: chiSquareVarianceInterval, tone: 'default' }],
});

// ---------------------------------------------------------------- the L11 worked example
export const L11_DATA = Object.freeze([3.1, 3.3, 2.9, 3.0, 3.1, 3.2, 2.8, 2.7, 3.1, 3.2, 2.9, 3.0, 2.9, 3.1, 2.8, 2.9, 3.2, 3.3, 2.9, 3.1, 3.2, 3.0]);
/** What the lecture prints for γ = 0.95, kept to show next to the correct values. */
export const L11_PRINTED = Object.freeze({
  s2: 0.0303,
  approxMean: [2.9593, 3.1043], approxVariance: [0.0119, 0.0487],
  tMean: [2.9528, 3.1108], chi2Variance: [0.017, 0.064], chi2Quantiles: [9.9, 37.6], t: 2.08,
});
export function lectureExample(gamma = 0.95) {
  const x = [...L11_DATA];
  return {
    n: x.length,
    sum: x.reduce((s, v) => s + v, 0),
    sumSquares: x.reduce((s, v) => s + v * v, 0),
    mean: mean(x),
    s2: variance(x, 'n-1'),
    approxMean: approxMeanInterval(x, gamma),
    approxVariance: approxVarianceInterval(x, gamma),
    tMean: tMeanInterval(x, gamma),
    chi2Variance: chiSquareVarianceInterval(x, gamma),
  };
}

// ---------------------------------------------------------------- two series of Bernoulli trials
/** Formula 139: z = (m₁/n₁ − m₂/n₂) / √(p̃(1 − p̃)(1/n₁ + 1/n₂)), p̃ = (m₁ + m₂)/(n₁ + n₂). */
export function homogeneityTest(m1, n1, m2, n2, alpha = 0.05) {
  const pooled = (m1 + m2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  const critical = normalQuantile(1 - alpha / 2);
  if (!(se > 0)) return { ok: false, code: 'degenerate', pooled, critical, detail: 'all trials gave the same outcome; z is undefined' };
  const z = (m1 / n1 - m2 / n2) / se;
  const pValue = Math.min(1, 2 * normalCdf(-Math.abs(z)));
  return { ok: true, z, pValue, pooled, critical, reject: Math.abs(z) > critical };
}
/** Formula 140: z = (m/n − p₀) / √(p₀(1 − p₀)/n). */
export function proportionTest(m, n, p0, alpha = 0.05) {
  const z = (m / n - p0) / Math.sqrt(p0 * (1 - p0) / n), critical = normalQuantile(1 - alpha / 2);
  return { ok: true, z, pValue: Math.min(1, 2 * normalCdf(-Math.abs(z))), critical, reject: Math.abs(z) > critical };
}

// ---------------------------------------------------------------- Monte Carlo bands
function binomialPmf(k, n, p) {
  return Math.exp(logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log1p(-p));
}
/** Exact acceptance region [lo, hi] for hits ~ Binomial(R, p): each tail has probability ≤ level/2. */
export function acceptanceBand(R, p, level = 0.001) {
  if (p <= 0) return { lo: 0, hi: 0 };
  if (p >= 1) return { lo: R, hi: R };
  let lo = 0, tail = 0;
  while (tail + binomialPmf(lo, R, p) <= level / 2) tail += binomialPmf(lo++, R, p);
  let hi = R; tail = 0;
  while (tail + binomialPmf(hi, R, p) <= level / 2) tail += binomialPmf(hi--, R, p);
  return { lo, hi };
}
const BAND_LEVEL = 0.001;

/** Hits of each method for R replicates of size n. Stream = 100 + n, so a given n never depends on the grid. */
export function coverageAt({ n, R, gamma, law, mu, sigma, target, seed }) {
  const truth = target === 'variance' ? sigma ** 2 : mu, methods = METHODS[target];
  const hits = methods.map(() => 0), width = methods.map(() => 0);
  for (let r = 0; r < R; r++) {
    const x = sampleOf({ law, mu, sigma, n, seed, stream: 100 + n, r });
    methods.forEach((m, j) => {
      const ci = m.build(x, gamma);
      if (ci.lower <= truth && truth <= ci.upper) hits[j]++;
      width[j] += ci.upper - ci.lower;
    });
  }
  return methods.map((m, j) => ({ id: m.id, label: m.label, tone: m.tone, hits: hits[j], R, coverage: hits[j] / R, meanWidth: width[j] / R }));
}

// ---------------------------------------------------------------- contract
const LAW = { key: 'law', label: 'Law (0 normal, 1 skewed exponential)', min: 0, max: 1, step: 1, default: 0 };
const SIGMA = { key: 'sigma', label: 'True $\\sigma$', min: 0.5, max: 3, step: 0.5, default: 1 };
const stationParams = {
  estimation: [
    { key: 'n', label: 'Sample size $n$', min: 2, max: 50, step: 1, default: 5 },
    SIGMA, LAW,
    { key: 'R', label: 'Replicates $R$', min: 500, max: 5000, step: 500, default: 2000 },
    { key: 'view', label: 'View (0 spread, 1 bias vs $n$, 2 MSE vs $n$)', min: 0, max: 2, step: 1, default: 0 },
  ],
  confidence: [
    { key: 'n', label: 'Sample size $n$', min: 2, max: 100, step: 1, default: 10 },
    { key: 'gamma', label: 'Confidence level $\\gamma$', min: 0.8, max: 0.99, step: 0.01, default: 0.95 },
    { key: 'target', label: 'Parameter (0 mean $M$, 1 variance $D$)', min: 0, max: 1, step: 1, default: 0 },
    LAW,
    { key: 'R', label: 'Replicates $R$', min: 200, max: 4000, step: 200, default: 1000 },
    { key: 'view', label: 'View (0 coverage vs $n$, 1 first 40 intervals)', min: 0, max: 1, step: 1, default: 0 },
  ],
  homogeneity: [
    { key: 'n1', label: 'Trials in series 1, $n_1$', min: 50, max: 2000, step: 50, default: 1000 },
    { key: 'p1', label: 'True $p_1$', min: 0.05, max: 0.95, step: 0.005, default: 0.485 },
    { key: 'n2', label: 'Trials in series 2, $n_2$', min: 50, max: 2000, step: 50, default: 1000 },
    { key: 'p2', label: 'True $p_2$', min: 0.05, max: 0.95, step: 0.005, default: 0.485 },
    { key: 'alpha', label: 'Significance level $\\alpha$', min: 0.01, max: 0.1, step: 0.01, default: 0.05 },
    { key: 'R', label: 'Repeated experiments $R$', min: 200, max: 2000, step: 200, default: 1000 },
  ],
};
export const stations = Object.freeze(Object.fromEntries(Object.entries(stationParams).map(([id, params]) => [id, { params }])));
export const meta = {
  id: 'lecture-estimation-intervals',
  lectures: ['L11'],
  title: 'Point estimates, confidence intervals and the homogeneity of two series',
  params: stationParams.confidence,
};

export function run(params, { seed, station = 'confidence' } = {}) {
  if (station === 'estimation') return runEstimation(params, seed);
  if (station === 'homogeneity') return runHomogeneity(params, seed);
  return runConfidence(params, seed);
}

const fmt = (v, d = 4) => Number(v).toFixed(d);
const MU = 0; // the true mean; it only shifts the picture

// ---------------------------------------------------------------- Estimation station
function estimatorsAt(n, R, law, sigma, seed) {
  const vn = new Float64Array(R), vn1 = new Float64Array(R), means = new Float64Array(R), meds = new Float64Array(R);
  for (let r = 0; r < R; r++) {
    const x = sampleOf({ law, mu: MU, sigma, n, seed, stream: 1000 + n, r });
    const ss = sumSquares(x);
    vn[r] = ss / n; vn1[r] = ss / (n - 1); means[r] = mean(x); meds[r] = median(x);
  }
  return { vn, vn1, means, meds };
}
function summary(values, truth) {
  const R = values.length;
  let m = 0;
  for (const v of values) m += v;
  m /= R;
  let v2 = 0, mse = 0, mse2 = 0;
  for (const v of values) { v2 += (v - m) ** 2; const e = (v - truth) ** 2; mse += e; mse2 += e * e; }
  const variance = v2 / (R - 1);
  mse /= R;
  return { mean: m, bias: m - truth, variance, mse, biasSE: Math.sqrt(variance / R), mseSE: Math.sqrt(Math.max(0, mse2 / R - mse * mse) / R) };
}
function runEstimation({ n, sigma, law, R, view }, seed) {
  const s2 = sigma ** 2, kappa = LAWS[law].kurtosis, th = oracles(n, s2, kappa);
  const e = estimatorsAt(n, R, law, sigma, seed);
  const sn = summary(e.vn, s2), sn1 = summary(e.vn1, s2), sm = summary(e.means, MU), smed = summary(e.meds, MU);
  const band = (s) => `observed ± ${fmt(4 * s.biasSE)} (4 Monte Carlo SE, $R = ${R}$)`;
  const readouts = [
    { key: 'bias-n', label: 'Bias of $s^2$ with divisor $n$ (124)', observed: sn.bias, theory: th['var-n'].bias, convention: band(sn) },
    { key: 'bias-n1', label: 'Bias of $s^2$ with divisor $n - 1$ (126)', observed: sn1.bias, theory: 0, convention: band(sn1) },
    { key: 'mse-n', label: 'MSE of $s^2$, divisor $n$', observed: sn.mse, theory: th['var-n'].mse, convention: `± ${fmt(4 * sn.mseSE)} (4 SE)` },
    { key: 'mse-n1', label: 'MSE of $s^2$, divisor $n - 1$', observed: sn1.mse, theory: th['var-n-1'].mse, convention: `± ${fmt(4 * sn1.mseSE)} (4 SE)` },
    { key: 'var-mean', label: '$D\\bar{x}$, variance of the mean (123)', observed: sm.variance, theory: s2 / n },
    { key: 'var-median', label: 'Variance of the median', observed: smed.variance, theory: law === 0 ? Math.PI * s2 / (2 * n) : null,
      convention: law === 0 ? 'theory is the large-$n$ value $\\dfrac{\\pi\\sigma^2}{2n}$' : 'no simple closed form for this law' },
    { key: 'efficiency', label: 'Efficiency $D\\bar{x} \\,/\\, D(\\mathrm{median})$', observed: sm.variance / smed.variance, theory: law === 0 ? 2 / Math.PI : null,
      convention: law === 0 ? 'large-$n$ limit $2/\\pi \\approx 0.637$' : undefined },
  ];
  const notes = [
    `Formula 124 divides by $n$ and is biased: $M s^2 = \\dfrac{n-1}{n}\\sigma^2$, so the bias is $-\\sigma^2/n = ${fmt(-s2 / n)}$ at $n = ${n}$. Formula 126 divides by $n - 1$ and is unbiased.`,
    'Unbiased does not mean more accurate: for normal data the divisor-$n$ estimator has the smaller MSE, $\\dfrac{(2n-1)\\sigma^4}{n^2}$ against $\\dfrac{2\\sigma^4}{n-1}$.',
    'Consistency: both MSEs fall to 0 as $n$ grows (view 2). Efficiency: for normal data the mean beats the median, whose variance is about $\\pi/2$ times larger.',
    law === 1 ? 'The skewed law has excess kurtosis $\\kappa = 6$, so $D s^2 = \\sigma^4\\left(\\dfrac{2}{n-1} + \\dfrac{\\kappa}{n}\\right)$ is far larger than for normal data.' : '$D s^2 = \\dfrac{2\\sigma^4}{n-1}$ for normal data, since $\\dfrac{(n-1)s^2}{\\sigma^2} \\sim \\chi^2(n-1)$.',
  ];
  let series, axes;
  if (view === 0) {
    const all = [...e.vn1].sort((a, b) => a - b), hi = all[Math.floor(0.99 * (R - 1))], bins = 30, w = hi / bins;
    const hist = (vals) => {
      const c = new Array(bins).fill(0);
      for (const v of vals) { const k = Math.floor(v / w); if (k >= 0 && k < bins) c[k]++; }
      return c.map((k) => k / (R * w));
    };
    const xs = Array.from({ length: bins }, (_, i) => i * w);
    series = [
      { id: 'hist-n1', kind: 'hist', tone: 'default', label: '$s^2$ with $n - 1$', x: xs, y: hist(e.vn1) },
      { id: 'hist-n', kind: 'hist', tone: 'muted', label: '$s^2$ with $n$', x: xs, y: hist(e.vn) },
      { id: 'truth', kind: 'rule', tone: 'signal', label: 'true $\\sigma^2$', x: [s2], y: [0] },
      { id: 'mean-n', kind: 'rule', tone: 'accent', label: 'average of $s^2$ with $n$', x: [sn.mean], y: [0] },
    ];
    axes = { x: 'estimate of $\\sigma^2$', y: 'density' };
  } else {
    const grid = [2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 40, 50];
    const Rg = Math.min(R, 2000);
    const obs = grid.map((k) => {
      const g = estimatorsAt(k, Rg, law, sigma, seed);
      return { n: k, a: summary(g.vn, s2), b: summary(g.vn1, s2) };
    });
    const fine = Array.from({ length: 49 }, (_, i) => i + 2);
    if (view === 1) {
      series = [
        { id: 'theory-n', kind: 'line', tone: 'signal', label: 'theory $-\\sigma^2/n$', x: fine, y: fine.map((k) => -s2 / k) },
        { id: 'zero', kind: 'line', tone: 'muted', label: 'unbiased (0)', x: [2, 50], y: [0, 0] },
        { id: 'obs-n', kind: 'points', tone: 'accent', label: 'observed bias, divisor $n$', x: grid, y: obs.map((o) => o.a.bias) },
        { id: 'obs-n1', kind: 'points', tone: 'default', label: 'observed bias, divisor $n - 1$', x: grid, y: obs.map((o) => o.b.bias) },
      ];
      axes = { x: 'sample size $n$', y: 'bias of $s^2$' };
    } else {
      series = [
        { id: 'theory-mse-n', kind: 'line', tone: 'signal', label: 'theory MSE, divisor $n$', x: fine, y: fine.map((k) => oracles(k, s2, kappa)['var-n'].mse) },
        { id: 'theory-mse-n1', kind: 'line', tone: 'muted', label: 'theory MSE, divisor $n - 1$', x: fine, y: fine.map((k) => oracles(k, s2, kappa)['var-n-1'].mse) },
        { id: 'obs-mse-n', kind: 'points', tone: 'accent', label: 'observed, divisor $n$', x: grid, y: obs.map((o) => o.a.mse) },
        { id: 'obs-mse-n1', kind: 'points', tone: 'default', label: 'observed, divisor $n - 1$', x: grid, y: obs.map((o) => o.b.mse) },
      ];
      axes = { x: 'sample size $n$', y: 'mean squared error of $s^2$' };
    }
    notes.push(`Each point uses $R = ${Rg}$ replicates of its own stream, so a point does not change when $n$ moves.`);
  }
  return { readouts, series, notes, axes };
}

// ---------------------------------------------------------------- Confidence station
export const COVERAGE_GRID = Object.freeze([3, 5, 8, 12, 20, 30, 50, 80, 100]);
function runConfidence({ n, gamma, target: t, law, R, view }, seed) {
  const target = t === 1 ? 'variance' : 'mean', sigma = 1, truth = target === 'variance' ? 1 : MU;
  const { lo, hi } = acceptanceBand(R, gamma, BAND_LEVEL);
  const here = coverageAt({ n, R, gamma, law, mu: MU, sigma, target, seed });
  const ex = lectureExample(gamma);
  const readouts = [
    ...here.map((c) => ({
      key: `coverage-${c.id}`, label: `Coverage at $n = ${n}$: ${c.label}`, observed: c.coverage, theory: gamma,
      convention: `${c.hits}/${R} hits; 99.9% Monte Carlo band ${fmt(lo / R, 3)}–${fmt(hi / R, 3)}${c.hits < lo ? ' — below the band' : c.hits > hi ? ' — above the band' : ''}`,
    })),
    ...here.map((c) => ({ key: `width-${c.id}`, label: `Mean width: ${c.label}`, observed: c.meanWidth, theory: null })),
    { key: 'l11-s2', label: 'L11 example: $s^2$ of the 22 values', observed: ex.s2, theory: null, convention: `lecture prints ${L11_PRINTED.s2}` },
    { key: 'l11-t', label: `L11 example: $t$ interval for $M$ ($\\gamma = ${gamma}$)`, observed: `$${fmt(ex.tMean.lower)} < M < ${fmt(ex.tMean.upper)}$`, theory: null,
      convention: `$t = ${fmt(ex.tMean.critical)}$${gamma === 0.95 ? `; lecture prints $${L11_PRINTED.tMean.join(' < M < ')}$` : ''}` },
    { key: 'l11-chi2', label: `L11 example: $\\chi^2$ interval for $D$ ($\\gamma = ${gamma}$)`, observed: `$${fmt(ex.chi2Variance.lower)} < D < ${fmt(ex.chi2Variance.upper)}$`, theory: null,
      convention: `$\\chi^2 = ${fmt(ex.chi2Variance.critical[0], 2)}$ and $${fmt(ex.chi2Variance.critical[1], 2)}$${gamma === 0.95 ? `; lecture prints $${L11_PRINTED.chi2Variance.join(' < D < ')}$ from 9.9 and 37.6` : ''}` },
    { key: 'l11-approx', label: `L11 example: approximate intervals ($\\gamma = ${gamma}$)`,
      observed: `$${fmt(ex.approxMean.lower)} < M < ${fmt(ex.approxMean.upper)}$; $${fmt(ex.approxVariance.lower)} < D < ${fmt(ex.approxVariance.upper)}$`, theory: null,
      convention: gamma === 0.95 ? `lecture prints $${L11_PRINTED.approxMean.join(' < M < ')}$; $${L11_PRINTED.approxVariance.join(' < D < ')}$ (from $s^2 = 0.0303$)` : undefined },
  ];
  const notes = [
    'An interval covers when it contains the true value. Over $R$ independent replicates the number of hits is $\\mathrm{Bin}(R, \\gamma)$ for an exact method, which gives the shaded band.',
    target === 'mean'
      ? 'The approximate interval (129) uses the normal quantile with the estimated $s$, so it is too narrow at small $n$; Student $t$ (136) is exact for normal data at every $n \\ge 2$.'
      : 'The approximate interval (130) treats $s^2$ as normal; $\\chi^2$ (138) is exact for normal data. Neither is robust to a skewed law: switch the law to 1 and watch both fall.',
    'Quantiles are computed, not read from tables. The lecture example $s^2 = 0.0303$ does not match its own 22 values; the lab uses 0.02799.',
  ];
  let series, axes;
  if (view === 0) {
    const grid = [...new Set([...COVERAGE_GRID, n])].filter((k) => k >= 2).sort((a, b) => a - b);
    const rows = grid.map((k) => (k === n ? here : coverageAt({ n: k, R, gamma, law, mu: MU, sigma, target, seed })));
    series = [
      { id: 'band', kind: 'band', tone: 'signal', label: `$\\gamma = ${gamma}$ with its 99.9% band`, x: [grid[0], grid.at(-1)], y: [lo / R, lo / R], y2: [hi / R, hi / R] },
      { id: 'nominal', kind: 'line', tone: 'signal', x: [grid[0], grid.at(-1)], y: [gamma, gamma] },
      ...METHODS[target].map((m, j) => ({ id: m.id, kind: 'line', tone: m.tone, label: m.label, x: grid, y: rows.map((r) => r[j].coverage) })),
      { id: 'chosen', kind: 'rule', tone: 'muted', label: `$n = ${n}$`, x: [n], y: [0] },
    ];
    axes = { x: 'sample size $n$', y: 'coverage, hits $/\\,R$' };
  } else {
    const K = Math.min(40, R), m = METHODS[target][1], xs = [], lower = [], upper = [], est = [], missX = [], missY = [];
    for (let r = 0; r < K; r++) {
      const ci = m.build(sampleOf({ law, mu: MU, sigma, n, seed, stream: 100 + n, r }), gamma);
      xs.push(r + 1); lower.push(ci.lower); upper.push(ci.upper); est.push(ci.estimate);
      if (!(ci.lower <= truth && truth <= ci.upper)) { missX.push(r + 1); missY.push(ci.estimate); }
    }
    series = [
      { id: 'truth', kind: 'line', tone: 'signal', label: target === 'mean' ? 'true $M$' : 'true $D$', x: [1, K], y: [truth, truth] },
      { id: 'lower', kind: 'points', tone: 'muted', label: `${m.label}: lower end`, x: xs, y: lower },
      { id: 'upper', kind: 'points', tone: 'muted', label: 'upper end', x: xs, y: upper },
      { id: 'estimate', kind: 'points', tone: 'default', label: 'estimate', x: xs, y: est },
      { id: 'missed', kind: 'points', tone: 'accent', label: `misses (${missX.length} of ${K})`, x: missX, y: missY },
    ];
    axes = { x: 'replicate', y: target === 'mean' ? 'interval for $M$' : 'interval for $D$' };
  }
  return { readouts, series, notes, axes };
}

// ---------------------------------------------------------------- Homogeneity station
function runHomogeneity({ n1, p1, n2, p2, alpha, R }, seed) {
  const zs = [];
  let rejected = 0, degenerate = 0, first = null;
  for (let r = 0; r < R; r++) {
    let m1 = 0, m2 = 0;
    for (let i = 0; i < n1; i++) if (uniform(seed, 2, r * STRIDE + i) < p1) m1++;
    for (let i = 0; i < n2; i++) if (uniform(seed, 3, r * STRIDE + i) < p2) m2++;
    const t = homogeneityTest(m1, n1, m2, n2, alpha);
    if (r === 0) first = { m1, m2, ...t };
    if (!t.ok) { degenerate++; continue; }
    zs.push(t.z);
    if (t.reject) rejected++;
  }
  const same = p1 === p2, crit = normalQuantile(1 - alpha / 2);
  // Power under H₁ by the normal approximation with unpooled variance.
  const d = p1 - p2, sd1 = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2), pbar = (p1 * n1 + p2 * n2) / (n1 + n2);
  const sd0 = Math.sqrt(pbar * (1 - pbar) * (1 / n1 + 1 / n2));
  const power = normalCdf((d - crit * sd0) / sd1) + normalCdf((-d - crit * sd0) / sd1);
  const valid = R - degenerate, expected = same ? alpha : power;
  const { lo, hi } = acceptanceBand(valid, Math.min(1 - 1e-12, Math.max(1e-12, expected)), BAND_LEVEL);
  // The normal approximation behind (139) needs enough successes and failures in each series.
  const smallest = Math.min(n1 * p1, n1 * (1 - p1), n2 * p2, n2 * (1 - p2)), rough = smallest < 10;
  const flag = rejected < lo ? ' — below the band' : rejected > hi ? ' — above the band' : '';
  const ex = homogeneityTest(480, 1000, 490, 1000, alpha), one = proportionTest(480, 1000, 0.5, alpha);
  const readouts = [
    { key: 'z-first', label: 'Your experiment: $z$ (139)', observed: first.ok ? first.z : '—', theory: null, convention: `$m_1 = ${first.m1}$ of ${n1}, $m_2 = ${first.m2}$ of ${n2}` },
    { key: 'p-first', label: 'Your experiment: two-sided $p$-value $2\\Phi(-|z|)$', observed: first.ok ? first.pValue : '—', theory: null, convention: '$\\Phi$ is the normal CDF from $-\\infty$' },
    { key: 'decision-first', label: `Decision at $\\alpha = ${alpha}$`, observed: first.ok ? (first.reject ? 'reject $H_0\\colon p_1 = p_2$' : 'do not reject $H_0$') : '$z$ undefined', theory: null, convention: `critical $|z| = ${fmt(crit, 3)}$` },
    { key: 'rejection-rate', label: same ? 'Rejection rate under $H_0$ (type I error)' : 'Rejection rate under $H_1$ (power)', observed: valid ? rejected / valid : null, theory: expected,
      convention: `${rejected}/${valid} rejections; 99.9% band ${fmt(lo / (valid || 1), 3)}–${fmt(hi / (valid || 1), 3)}${flag}${same ? '' : '; theory is the normal approximation'}${rough ? `; the smallest expected count is ${fmt(smallest, 1)} (below 10), so z is only roughly normal` : ''}` },
    { key: 'l11-z', label: 'L11 example: $z$ for 480/1000 and 490/1000', observed: ex.z, theory: null, convention: `$p = ${fmt(ex.pValue, 3)}$; lecture prints $-0.447$` },
    { key: 'l11-z140', label: 'L11 example: $z$ (140) for $H_0\\colon p = 0.5$, series 1', observed: one.z, theory: null,
      convention: 'lecture writes the numerator as 0.480 − 0.490 but its value −1.26 matches 0.480 − 0.5' },
  ];
  const lim = 4, bins = 32, w = 2 * lim / bins, c = new Array(bins).fill(0);
  for (const z of zs) { const k = Math.floor((z + lim) / w); if (k >= 0 && k < bins) c[k]++; }
  const xs = Array.from({ length: bins }, (_, i) => -lim + i * w), grid = Array.from({ length: 161 }, (_, i) => -lim + i * 0.05);
  const series = [
    { id: 'hist', kind: 'hist', tone: 'default', label: `simulated $z$, $R = ${R}$`, x: xs, y: c.map((k) => k / ((zs.length || 1) * w)) },
    { id: 'pdf', kind: 'pdf', tone: 'signal', label: '$N(0, 1)$ under $H_0$', x: grid, y: grid.map((z) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI)) },
    { id: 'critical', kind: 'rule', tone: 'accent', label: `$\\pm ${fmt(crit, 3)}$`, x: [-crit, crit], y: [0, 0] },
  ];
  if (first.ok) series.push({ id: 'first', kind: 'rule', tone: 'muted', label: 'your $z$', x: [first.z], y: [0] });
  const notes = [
    'Formula 139 pools both series: $\\tilde{p} = \\dfrac{m_1 + m_2}{n_1 + n_2}$. Under $H_0\\colon p_1 = p_2$ the statistic is approximately $N(0, 1)$.',
    'Set $p_1 = p_2$ to see the type I error stay near $\\alpha$; move them apart to see the power grow with $n_1$ and $n_2$.',
    rough ? `Here $np$ or $n(1 - p)$ is as small as ${fmt(smallest, 1)}: $z$ is discrete and skewed, so its rejection rate can leave the band around $\\alpha$. That is the limit of the normal approximation, not a simulation error.` : 'Every series expects at least 10 successes and 10 failures, so the normal approximation of $z$ is reasonable.',
    degenerate ? `${degenerate} replicate(s) had $\\tilde{p} = 0$ or $1$, where $z$ is undefined; they are left out.` : 'No replicate was degenerate ($\\tilde{p} = 0$ or $1$).',
  ];
  return { readouts, series, notes, axes: { x: '$z$ statistic', y: 'density' } };
}
