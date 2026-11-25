// Throwaway Discovery spike for issue #47 (lecture 12). Not product code.
// One kernel, three stations of the Hypothesis Testing slot: Proportion (z-test for p), Mean (z-test with σ known,
// t-test with σ unknown) and Variances (F-test). Every station has three views: 0 critical regions on the null
// density with the alternative and β, 1 the power curve (exact theory + seeded Monte Carlo with its band),
// 2 the null distribution of the simulated statistic and the type I error.
// Contract: docs/research/lecture-module-map.md and spikes/visual-foundation/src/stations/kernel-contract.ts.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import {
  normalCdf, normalSf, laplacePhi0, normalQuantile, logGamma,
  studentTCdf, studentTQuantile as tQ, fisherCdf, fisherSf, fisherQuantile as fQ,
} from './special.mjs';

// Quantiles depend only on (p, df); simulation and curves ask for the same ones many times.
const memo = (f) => { const cache = new Map(); return (...a) => { const k = a.join('|'); let v = cache.get(k); if (v === undefined) cache.set(k, v = f(...a)); return v; }; };
const studentTQuantile = memo(tQ), fisherQuantile = memo(fQ), zQ = memo(normalQuantile);

// ---------------------------------------------------------------- randomness
const NAMESPACE = 0x4712; // keeps these streams apart from other kernels that share a seed
const STRIDE = 4096; // index = replicate · STRIDE + i, so n ≤ STRIDE
const STREAM = Object.freeze({ mean: 1, x: 2, y: 3, bern: 4, ownMean: 11, ownX: 12, ownY: 13, ownBern: 14 });
const uniform = (seed, stream, index) => (fixtureUint32(seed, stream, index, NAMESPACE) + 0.5) / 2 ** 32;
const gauss = (seed, stream, index) => normalQuantile(uniform(seed, stream, index));

// ---------------------------------------------------------------- critical regions (L12 §Critical regions)
export const TAILS = Object.freeze(['two', 'right', 'left']);
const tailOf = (i) => TAILS[i] ?? 'two';
/** Quantile of the null law of the statistic. dist: { kind: 'z' } | { kind: 't', df } | { kind: 'F', df1, df2 }. */
function nullQuantile(dist, p) {
  if (dist.kind === 't') return studentTQuantile(p, dist.df);
  if (dist.kind === 'F') return fisherQuantile(p, dist.df1, dist.df2);
  return zQ(p);
}
/**
 * The critical region at level α: reject below `lower` or above `upper` (null = that side is open).
 * Two-sided puts α/2 in each tail (the most powerful split for a symmetric law, L12 §test for p, case 1).
 */
export function criticalRegion(dist, alpha, tail) {
  if (tail === 'right') return { lower: null, upper: nullQuantile(dist, 1 - alpha) };
  if (tail === 'left') return { lower: nullQuantile(dist, alpha), upper: null };
  return { lower: nullQuantile(dist, alpha / 2), upper: nullQuantile(dist, 1 - alpha / 2) };
}
const rejects = (stat, region) => (region.lower !== null && stat < region.lower) || (region.upper !== null && stat > region.upper);

// ---------------------------------------------------------------- the three tests
const mean = (x) => x.reduce((s, v) => s + v, 0) / x.length;
const corrVar = (x) => { const m = mean(x); return x.reduce((s, v) => s + (v - m) ** 2, 0) / (x.length - 1); };
function pValueFrom(cdf, sf, stat, tail) {
  if (tail === 'right') return sf(stat);
  if (tail === 'left') return cdf(stat);
  return Math.min(1, 2 * Math.min(cdf(stat), sf(stat)));
}

/** L12 formula (2): U = (m/n − p₀)·√n / √(p₀q₀), approximately N(0, 1) under H₀ by the de Moivre–Laplace theorem. */
export function proportionTest(m, n, p0, alpha, tail) {
  const U = (m / n - p0) * Math.sqrt(n) / Math.sqrt(p0 * (1 - p0));
  const region = criticalRegion({ kind: 'z' }, alpha, tail);
  return { U, region, critical: zQ(tail === 'two' ? 1 - alpha / 2 : 1 - alpha), reject: rejects(U, region), pValue: pValueFrom(normalCdf, normalSf, U, tail) };
}

/** L12 formulas (3)–(5): U = (x̄ − a₀)√n/σ with σ known; T = (x̄ − a₀)√n/s with s corrected, df = n − 1. */
export function meanTest(x, a0, alpha, tail, sigma = null) {
  const n = x.length, xbar = mean(x);
  if (sigma !== null) {
    const U = (xbar - a0) * Math.sqrt(n) / sigma, region = criticalRegion({ kind: 'z' }, alpha, tail);
    return { stat: U, dist: { kind: 'z' }, xbar, region, reject: rejects(U, region), pValue: pValueFrom(normalCdf, normalSf, U, tail) };
  }
  const s = Math.sqrt(corrVar(x)), T = (xbar - a0) * Math.sqrt(n) / s, dist = { kind: 't', df: n - 1 }, region = criticalRegion(dist, alpha, tail);
  return { stat: T, dist, xbar, s, region, reject: rejects(T, region), pValue: pValueFrom((t) => studentTCdf(t, n - 1), (t) => studentTCdf(-t, n - 1), T, tail) };
}

/**
 * L12 formula (6) with the correct one-sided rule.
 * Two-sided: F = larger s² / smaller s², df of the larger first, reject above F(1 − α/2; k₁, k₂).
 * Right (H₁: D(X) > D(Y)): F = s²_X / s²_Y, df (n_X − 1, n_Y − 1), reject above F(1 − α). Left mirrors it.
 * `ratio` is always s²_X / s²_Y and `regionXY` the same decision written on that ratio (for the chart).
 */
export function fTest(x, y, alpha, tail) {
  const sx = corrVar(x), sy = corrVar(y), kx = x.length - 1, ky = y.length - 1, ratio = sx / sy;
  let F, df1, df2, critical;
  if (tail === 'two') {
    [F, df1, df2] = sx >= sy ? [ratio, kx, ky] : [1 / ratio, ky, kx];
    critical = fisherQuantile(1 - alpha / 2, df1, df2);
  } else if (tail === 'right') {
    [F, df1, df2] = [ratio, kx, ky]; critical = fisherQuantile(1 - alpha, df1, df2);
  } else {
    [F, df1, df2] = [1 / ratio, ky, kx]; critical = fisherQuantile(1 - alpha, df1, df2);
  }
  const pOne = fisherSf(F, df1, df2);
  return {
    F, df1, df2, critical, reject: F > critical, s2x: sx, s2y: sy, ratio,
    regionXY: criticalRegion({ kind: 'F', df1: kx, df2: ky }, alpha, tail),
    pValue: tail === 'two' ? Math.min(1, 2 * pOne) : pOne,
  };
}

// ---------------------------------------------------------------- the L12 worked example
export const L12_PRINTED = Object.freeze({ U: 0.471, critical: 2.33, phi0: 0.49 });
export function lectureExample() {
  const n = 50, freq = 0.12, p0 = 0.1, alpha = 0.01;
  const U = (freq - p0) * Math.sqrt(n) / Math.sqrt(p0 * (1 - p0)), critical = zQ(1 - alpha);
  return { n, freq, p0, alpha, U, critical, phi0AtCritical: laplacePhi0(critical), reject: U > critical, exactSize: proportionSize(n, p0, alpha, 'right') };
}

// ---------------------------------------------------------------- exact power (probability of the critical region under H₁)
const lchoose = (n, k) => logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
function binomialPmf(k, n, p) {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
}
/** Exact: Σ over m whose U falls in the critical region of Binomial(n, p) probabilities. */
export function proportionPower(n, p0, p, alpha, tail) {
  let s = 0;
  for (let m = 0; m <= n; m++) if (proportionTest(m, n, p0, alpha, tail).reject) s += binomialPmf(m, n, p);
  return Math.min(1, s);
}
/** The real type I error of the normal-approximation test: its power at p = p₀. */
export const proportionSize = (n, p0, alpha, tail) => proportionPower(n, p0, p0, alpha, tail);

/** z-test power at d = (μ − a₀)/σ: U ~ N(δ, 1), δ = d√n. */
export function zPower(d, n, alpha, tail) {
  const delta = d * Math.sqrt(n), r = criticalRegion({ kind: 'z' }, alpha, tail);
  return (r.upper !== null ? normalSf(r.upper - delta) : 0) + (r.lower !== null ? normalCdf(r.lower - delta) : 0);
}

// Noncentral t by one integral over W = √V, V ~ χ²_k: T = (Z + δ)/(W/√k).
// The integrand Φ(c·W/√k − δ) can switch from 1 to 0 within Δw ≈ √k/|c| (k = 1, α = 0.001 gives c ≈ 318),
// so the window √k ± 10 is cut at 40 even steps plus the w where z = c·w/√k − δ runs over −9…9, and
// each piece gets a 10-panel Simpson rule. That resolves both the χ density and the normal switch.
function chiLogNorm(k) { return (1 - k / 2) * Math.LN2 - logGamma(k / 2); }
function chiDensity(x, k, logNorm) {
  if (x > 0) return Math.exp(logNorm + (k - 1) * Math.log(x) - x * x / 2);
  return k === 1 ? Math.exp(logNorm) : 0;
}
/** ∫ f(z(w), w)·χ_k(w) dw with z = c·w/√k − δ. */
function chiIntegral(k, c, delta, f) {
  const sk = Math.sqrt(k), a = Math.max(0, sk - 10), b = sk + 10, logNorm = chiLogNorm(k);
  const cuts = [];
  for (let i = 0; i <= 40; i++) cuts.push(a + (b - a) * i / 40);
  if (c !== 0) for (let z = -9; z <= 9; z += 0.5) { const w = (z + delta) * sk / c; if (w > a && w < b) cuts.push(w); }
  cuts.sort((u, v) => u - v);
  const PANELS = 10;
  let total = 0;
  for (let j = 1; j < cuts.length; j++) {
    const lo = cuts[j - 1], hi = cuts[j], h = (hi - lo) / PANELS;
    if (!(h > 0)) continue;
    let s = 0;
    for (let i = 0; i <= PANELS; i++) {
      const w = lo + i * h, coef = i === 0 || i === PANELS ? 1 : i % 2 ? 4 : 2;
      s += coef * f(c * w / sk - delta, w) * chiDensity(w, k, logNorm);
    }
    total += s * h / 3;
  }
  return total;
}
/** P(T > c) and P(T < c) for the noncentral t with k df and noncentrality δ. */
function nctTails(c, k, delta) {
  return { up: chiIntegral(k, c, delta, (z) => normalSf(z)), lo: chiIntegral(k, c, delta, (z) => normalCdf(z)) };
}
function nctPdf(t, k, delta) {
  const sk = Math.sqrt(k);
  return chiIntegral(k, t, delta, (z, w) => Math.exp(-z * z / 2) * w / sk) / Math.sqrt(2 * Math.PI);
}
/** t-test power at d = (μ − a₀)/σ with sample size n: noncentral t, df = n − 1, δ = d√n. */
export function tPower(d, n, alpha, tail) {
  const k = n - 1, delta = d * Math.sqrt(n), r = criticalRegion({ kind: 't', df: k }, alpha, tail);
  return (r.upper !== null ? nctTails(r.upper, k, delta).up : 0) + (r.lower !== null ? nctTails(r.lower, k, delta).lo : 0);
}

/**
 * F-test power at ρ = σ²_X/σ²_Y with df1 = n_X − 1, df2 = n_Y − 1: s²_X/s²_Y = ρ·F(df1, df2) exactly.
 * `lectureRule`: the lecture's one-sided rule, larger/smaller against F(1 − α), which also rejects when s²_Y is the larger.
 */
export function fPower(rho, df1, df2, alpha, tail, { lectureRule = false } = {}) {
  if (lectureRule && tail !== 'two') {
    const c1 = fisherQuantile(1 - alpha, df1, df2), c2 = fisherQuantile(1 - alpha, df2, df1);
    return fisherSf(c1 / rho, df1, df2) + fisherCdf(1 / (c2 * rho), df1, df2);
  }
  const r = criticalRegion({ kind: 'F', df1, df2 }, alpha, tail);
  return (r.upper !== null ? fisherSf(r.upper / rho, df1, df2) : 0) + (r.lower !== null ? fisherCdf(r.lower / rho, df1, df2) : 0);
}

// ---------------------------------------------------------------- Monte Carlo bands
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

// ---------------------------------------------------------------- simulation (common random numbers over the grid)
/**
 * R replicates of n standard normal draws; for each d on the grid the sample is d + Zᵢ (σ = 1, a₀ = 0),
 * so every point of the power curve reuses the same draws and the curve is monotone in d.
 */
export function simulateMean({ n, R, seed, sigmaKnown, alpha, tail, grid, keepStats = false }) {
  if (n > STRIDE) throw new RangeError(`n must be at most ${STRIDE}`);
  const dist = sigmaKnown ? { kind: 'z' } : { kind: 't', df: n - 1 }, region = criticalRegion(dist, alpha, tail);
  const hits = grid.map(() => 0), stats = keepStats ? [] : null, rn = Math.sqrt(n);
  for (let r = 0; r < R; r++) {
    let s = 0, s2 = 0;
    for (let i = 0; i < n; i++) { const z = gauss(seed, STREAM.mean, r * STRIDE + i); s += z; s2 += z * z; }
    const zbar = s / n, sd = sigmaKnown ? 1 : Math.sqrt(Math.max(0, (s2 - n * zbar * zbar) / (n - 1)));
    grid.forEach((d, j) => { const st = (d + zbar) * rn / sd; if (rejects(st, region)) hits[j]++; if (keepStats && j === 0) stats.push(st); });
  }
  return { hits, R, stats };
}
/** R replicates of s²_X (n₁ draws) and s²_Y (n₂ draws) from N(0, 1); for ρ on the grid the ratio is ρ·s²_X/s²_Y. */
export function simulateVariances({ n1, n2, R, seed, alpha, tail, grid, keepStats = false }) {
  const k1 = n1 - 1, k2 = n2 - 1, region = criticalRegion({ kind: 'F', df1: k1, df2: k2 }, alpha, tail);
  const c1 = fisherQuantile(1 - alpha, k1, k2), c2 = fisherQuantile(1 - alpha, k2, k1);
  const hits = grid.map(() => 0), lectureRuleHits = grid.map(() => 0), stats = keepStats ? [] : null;
  const sVar = (stream, r, n) => {
    let s = 0, s2 = 0;
    for (let i = 0; i < n; i++) { const z = gauss(seed, stream, r * STRIDE + i); s += z; s2 += z * z; }
    return (s2 - s * s / n) / (n - 1);
  };
  for (let r = 0; r < R; r++) {
    const q = sVar(STREAM.x, r, n1) / sVar(STREAM.y, r, n2);
    grid.forEach((rho, j) => {
      const ratio = rho * q;
      if (rejects(ratio, region)) hits[j]++;
      // The lecture's one-sided rule: larger over smaller against $F(1 - \\alpha)$ with the larger sample's df first.
      if (ratio >= 1 ? ratio > c1 : 1 / ratio > c2) lectureRuleHits[j]++;
      if (keepStats && j === 0) stats.push(ratio);
    });
  }
  return { hits, lectureRuleHits, R, stats };
}
/** R replicates of n uniforms; for p on the grid, m = #{uᵢ < p} is Binomial(n, p). */
export function simulateProportion({ n, p0, R, seed, alpha, tail, grid, keepStats = false }) {
  if (n > STRIDE) throw new RangeError(`n must be at most ${STRIDE}`);
  const hits = grid.map(() => 0), counts = keepStats ? new Array(n + 1).fill(0) : null;
  const rejectAt = Array.from({ length: n + 1 }, (_, m) => proportionTest(m, n, p0, alpha, tail).reject);
  const u = new Float64Array(n);
  for (let r = 0; r < R; r++) {
    for (let i = 0; i < n; i++) u[i] = uniform(seed, STREAM.bern, r * STRIDE + i);
    u.sort();
    grid.forEach((p, j) => {
      let lo = 0, hi = n; // first index with u ≥ p
      while (lo < hi) { const mid = (lo + hi) >> 1; if (u[mid] < p) lo = mid + 1; else hi = mid; }
      if (rejectAt[lo]) hits[j]++;
      if (keepStats && j === 0) counts[lo]++;
    });
  }
  return { hits, R, counts };
}

// ---------------------------------------------------------------- contract
const TAIL = { key: 'tail', label: '$H_1$ (0 two-sided $\\ne$, 1 right $>$, 2 left $<$)', min: 0, max: 2, step: 1, default: 1 };
const ALPHA = { key: 'alpha', label: 'Significance level $\\alpha$', min: 0.001, max: 0.2, step: 0.001, default: 0.05 };
const REPS = { key: 'R', label: 'Replicates $R$', min: 200, max: 4000, step: 200, default: 1000 };
const VIEW = { key: 'view', label: 'View (0 critical region, 1 power curve, 2 type I error)', min: 0, max: 2, step: 1, default: 0 };
const stationParams = {
  proportion: [
    { key: 'p0', label: '$H_0\\colon p = p_0$', min: 0.05, max: 0.95, step: 0.01, default: 0.1 },
    { key: 'p', label: 'True $p$ ($H_1$ when $p \\ne p_0$)', min: 0.01, max: 0.99, step: 0.01, default: 0.12 },
    { key: 'n', label: 'Trials $n$', min: 10, max: 500, step: 1, default: 50 },
    { ...ALPHA, default: 0.01 }, TAIL, REPS, VIEW,
  ],
  mean: [
    { key: 'sigmaKnown', label: '$\\sigma$ (1 known: $z$-test, 0 unknown: $t$-test)', min: 0, max: 1, step: 1, default: 0 },
    { key: 'mu', label: 'True $M(X)$ ($H_0\\colon a_0 = 0$, $\\sigma = 1$)', min: -1.5, max: 1.5, step: 0.05, default: 0.5 },
    { key: 'n', label: 'Sample size $n$', min: 2, max: 200, step: 1, default: 12 },
    ALPHA, TAIL, REPS, VIEW,
  ],
  variances: [
    { key: 'rho', label: 'True ratio $\\rho = D(X)/D(Y)$', min: 0.25, max: 4, step: 0.05, default: 2 },
    { key: 'n1', label: 'Sample size $n_1$ ($X$)', min: 3, max: 100, step: 1, default: 10 },
    { key: 'n2', label: 'Sample size $n_2$ ($Y$)', min: 3, max: 100, step: 1, default: 15 },
    ALPHA, TAIL, REPS, VIEW,
  ],
};
export const stations = Object.freeze(Object.fromEntries(Object.entries(stationParams).map(([id, params]) => [id, { params }])));
export const meta = {
  id: 'lecture-hypothesis-tests',
  lectures: ['L12'],
  title: 'Critical regions, type I and II errors and power of the z, t and F tests',
  params: stationParams.mean,
};

/** Defaults, then overrides clamped to the range and snapped to the step (the host does the same). */
function resolve(params, overrides) {
  const out = {};
  for (const p of params) {
    const raw = overrides?.[p.key];
    if (!Number.isFinite(raw)) { out[p.key] = p.default; continue; }
    const v = Math.min(p.max, Math.max(p.min, raw));
    out[p.key] = Number((v === p.max || v === p.min ? v : p.min + Math.round((v - p.min) / p.step) * p.step).toPrecision(12));
  }
  return out;
}

export function run(params, { seed, station = 'mean' } = {}) {
  const st = stationParams[station] ? station : 'mean', q = resolve(stationParams[st], params), s = (seed >>> 0);
  if (st === 'proportion') return runProportion(q, s);
  if (st === 'variances') return runVariances(q, s);
  return runMean(q, s);
}

// ---------------------------------------------------------------- shared drawing helpers
const fmt = (v, d = 4) => (Number.isFinite(v) ? Number(v).toFixed(d) : String(v));
const GRID_N = 241, BAND_N = 61;
const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
const phi = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
/** A band under `pdf` from a to b clipped to [x0, x1]; an empty side collapses to zero height at the edge. */
function regionBand(id, label, pdf, a, b, x0, x1, active) {
  const lo = Math.max(a, x0), hi = Math.min(b, x1);
  if (!active || !(hi > lo)) {
    const edge = a <= x0 ? x0 : x1;
    return { id, kind: 'band', tone: 'accent', label, x: new Array(BAND_N).fill(edge), y: new Array(BAND_N).fill(0), y2: new Array(BAND_N).fill(0) };
  }
  const x = linspace(lo, hi, BAND_N);
  return { id, kind: 'band', tone: 'accent', label, x, y: new Array(BAND_N).fill(0), y2: x.map(pdf) };
}
function criticalBands(region, pdf, x0, x1, unit = '') {
  return [
    regionBand('crit-left', region.lower !== null ? `critical region $< ${fmt(region.lower, 3)}$${unit}` : 'critical region (left, unused)', pdf, -Infinity, region.lower ?? -Infinity, x0, x1, region.lower !== null),
    regionBand('crit-right', region.upper !== null ? `critical region $> ${fmt(region.upper, 3)}$${unit}` : 'critical region (right, unused)', pdf, region.upper ?? Infinity, Infinity, x0, x1, region.upper !== null),
  ];
}
/** β as bands under the alternative density over the acceptance region (always one band, stable). */
function betaBand(region, pdf, x0, x1) {
  const a = region.lower ?? x0, b = region.upper ?? x1;
  const band = regionBand('beta', '$\\beta$: $H_1$ true, statistic in the acceptance region', pdf, a, b, x0, x1, true);
  return { ...band, tone: 'muted' };
}
function powerReadouts({ R, hits, theory, nullHits, size, alpha, isNull, exactLabel }) {
  const band = acceptanceBand(R, Math.min(1, Math.max(0, theory)), BAND_LEVEL);
  const sizeBand = acceptanceBand(R, size, BAND_LEVEL);
  const flag = (h, b) => (h < b.lo ? ' — below the band' : h > b.hi ? ' — above the band' : '');
  return [
    { key: 'type1', label: 'Type I error: rejection rate when $H_0$ is true', observed: nullHits / R, theory: size,
      convention: `${nullHits}/${R} rejections; 99.9% band ${fmt(sizeBand.lo / R, 3)}–${fmt(sizeBand.hi / R, 3)}${flag(nullHits, sizeBand)}${Math.abs(size - alpha) > 1e-9 ? `; nominal $\\alpha = ${alpha}$, exact size ${fmt(size)}` : ''}` },
    isNull
      ? { key: 'power', label: 'Power $1 - \\beta$ at the true value', observed: null, theory: null, convention: 'the true value equals $H_0$: there is no alternative, every rejection is a type I error' }
      : { key: 'power', label: 'Power $1 - \\beta$ at the true value', observed: hits / R, theory, convention: `${hits}/${R} rejections; 99.9% band ${fmt(band.lo / R, 3)}–${fmt(band.hi / R, 3)}${flag(hits, band)}; theory ${exactLabel}` },
    { key: 'beta', label: 'Type II error $\\beta = 1 - \\text{power}$', observed: isNull ? null : 1 - hits / R, theory: isNull ? null : 1 - theory },
  ];
}
function powerSeries(gridTheory, theory, gridMc, mcTheory, hits, R, xMark, alpha, size) {
  const bands = mcTheory.map((p) => acceptanceBand(R, Math.min(1, Math.max(0, p)), BAND_LEVEL));
  return [
    { id: 'power-band', kind: 'band', tone: 'signal', label: `99.9% Monte Carlo band ($R = ${R}$)`, x: gridMc, y: bands.map((b) => b.lo / R), y2: bands.map((b) => b.hi / R) },
    { id: 'power-theory', kind: 'line', tone: 'signal', label: 'exact power', x: gridTheory, y: theory },
    { id: 'power-mc', kind: 'points', tone: 'default', label: 'simulated rejection rate', x: gridMc, y: hits.map((h) => h / R) },
    { id: 'alpha-line', kind: 'line', tone: 'accent', label: size !== undefined && Math.abs(size - alpha) > 1e-9 ? `$\\alpha = ${alpha}$ (exact size ${fmt(size, 3)})` : `$\\alpha = ${alpha}$`, x: [gridTheory[0], gridTheory.at(-1)], y: [alpha, alpha] },
    { id: 'true-value', kind: 'rule', tone: 'muted', label: 'true value', x: [xMark], y: [0] },
  ];
}
function nullHistogram(stats, x0, x1, bins = 40) {
  const w = (x1 - x0) / bins, c = new Array(bins).fill(0);
  for (const v of stats) { const k = Math.floor((v - x0) / w); if (k >= 0 && k < bins) c[k]++; }
  return { x: Array.from({ length: bins }, (_, i) => x0 + i * w), y: c.map((k) => k / (stats.length * w)) };
}
const decisionText = (reject) => (reject ? 'reject $H_0$' : 'keep $H_0$');
const tailText = { two: 'two-sided ($\\ne$)', right: 'right-sided ($>$)', left: 'left-sided ($<$)' };

// ---------------------------------------------------------------- Proportion station
const P_GRID_THEORY = linspace(0.01, 0.99, 99), P_GRID_MC = linspace(0.02, 0.98, 33);
function runProportion({ p0, p, n, alpha, tail: ti, R, view }, seed) {
  const tail = tailOf(ti), sd0 = Math.sqrt(p0 * (1 - p0) / n);
  const region = criticalRegion({ kind: 'z' }, alpha, tail);
  // Your experiment: n Bernoulli(p) trials from their own stream.
  let m = 0;
  for (let i = 0; i < n; i++) if (uniform(seed, STREAM.ownBern, i) < p) m++;
  const own = proportionTest(m, n, p0, alpha, tail), ex = lectureExample();
  const size = proportionSize(n, p0, alpha, tail), theory = proportionPower(n, p0, p, alpha, tail);
  const sim = simulateProportion({ n, p0, R, seed, alpha, tail, grid: [p0, p], keepStats: view === 2 });
  const isNull = Math.abs(p - p0) < 1e-12;
  // Critical region on the frequency axis m/n: p₀ ± u_cr·√(p₀q₀/n).
  const toFreq = (u) => (u === null ? null : p0 + u * sd0), fRegion = { lower: toFreq(region.lower), upper: toFreq(region.upper) };
  const readouts = [
    { key: 'statistic', label: 'Your experiment: $U = \\dfrac{(m/n - p_0)\\sqrt{n}}{\\sqrt{p_0 q_0}}$ (2)', observed: own.U, theory: null, convention: `$m = ${m}$ of $n = ${n}$, frequency ${fmt(m / n, 3)}; true $p = ${p}$` },
    { key: 'critical', label: `Critical value $u_{\\mathrm{cr}}$, ${tailText[tail]}`, observed: null, theory: tail === 'two' ? zQ(1 - alpha / 2) : zQ(1 - alpha),
      convention: tail === 'two' ? `$\\Phi_0(u_{\\mathrm{cr}}) = \\dfrac{1 - \\alpha}{2} = ${fmt((1 - alpha) / 2)}$; $\\Phi_0$ is the Laplace function from 0` : `$\\Phi_0(u_{\\mathrm{cr}}) = \\dfrac{1 - 2\\alpha}{2} = ${fmt((1 - 2 * alpha) / 2)}$; $\\Phi_0$ is the Laplace function from 0` },
    { key: 'decision', label: `Decision at $\\alpha = ${alpha}$`, observed: decisionText(own.reject), theory: null, convention: `$p$-value ${fmt(own.pValue)} from the normal approximation` },
    ...powerReadouts({ R, hits: sim.hits[1], theory, nullHits: sim.hits[0], size, alpha, isNull, exactLabel: 'is the exact binomial sum over the critical region' }),
    { key: 'l12-example', label: 'L12 example: $n = 50$, frequency 0.12, $H_0\\colon p = 0.1$, $\\alpha = 0.01$, right-sided',
      observed: `$U = ${fmt(ex.U, 3)}$, $u_{\\mathrm{cr}} = ${fmt(ex.critical, 3)}$, ${decisionText(ex.reject)}`, theory: null,
      convention: `lecture prints $u_{\\mathrm{cr}} = ${L12_PRINTED.critical}$ from the table ($\\Phi_0(u_{\\mathrm{cr}}) = 0.49$); the exact size of this test is ${fmt(ex.exactSize)}, not 0.01` },
  ];
  const notes = [
    'L12 formula (2): $U$ is approximately $N(0, 1)$ under $H_0$ by the de Moivre–Laplace theorem. The critical region is chosen so that $P(U \\in \\text{region} \\mid H_0) = \\alpha$.',
    'The chart uses the frequency $m/n$: the critical region is $p_0 \\pm u_{\\mathrm{cr}}\\sqrt{p_0 q_0/n}$. Stems are the exact binomial probabilities divided by the spacing $1/n$, so they compare with the normal density.',
    `$m$ is discrete, so the real type I error is not $\\alpha$: here it is ${fmt(size)} against nominal $\\alpha = ${alpha}$. The rejection rate under $H_0$ is checked against this exact size.`,
    'Power $1 - \\beta$ is the probability of the critical region when $H_1$ is true; it grows with $|p - p_0|$ and with $n$.',
  ];
  let series, axes;
  if (view === 0) {
    const x = linspace(0, 1, GRID_N), nullPdf = (f) => phi((f - p0) / sd0) / sd0;
    const ms = Array.from({ length: n + 1 }, (_, k) => k);
    series = [
      { id: 'null-pdf', kind: 'pdf', tone: 'signal', label: '$H_0$: normal approximation $N(p_0,\\, p_0 q_0/n)$', x, y: x.map(nullPdf) },
      ...criticalBands(fRegion, nullPdf, 0, 1),
      { id: 'null-pmf', kind: 'pmf', tone: 'muted', label: '$H_0$: exact $\\mathrm{Bin}(n, p_0) \\cdot n$', x: ms.map((k) => k / n), y: ms.map((k) => binomialPmf(k, n, p0) * n) },
      { id: 'alt-pmf', kind: 'pmf', tone: 'default', label: `true $p = ${p}$: $\\mathrm{Bin}(n, p) \\cdot n$`, x: ms.map((k) => k / n), y: ms.map((k) => binomialPmf(k, n, p) * n) },
      { id: 'observed', kind: 'rule', tone: 'default', label: `your frequency ${fmt(m / n, 3)}`, x: [m / n], y: [0] },
    ];
    axes = { x: 'relative frequency $m/n$', y: 'density (probability $\\times\\, n$ for stems)' };
  } else if (view === 1) {
    const mc = simulateProportion({ n, p0, R, seed, alpha, tail, grid: P_GRID_MC });
    series = powerSeries(P_GRID_THEORY, P_GRID_THEORY.map((v) => proportionPower(n, p0, v, alpha, tail)), P_GRID_MC,
      P_GRID_MC.map((v) => proportionPower(n, p0, v, alpha, tail)), mc.hits, R, p, alpha, size);
    series.push({ id: 'null-value', kind: 'rule', tone: 'accent', label: '$p_0$', x: [p0], y: [0] });
    axes = { x: 'true probability $p$', y: '$P(\\text{reject } H_0)$ = power ($\\alpha$ at $p = p_0$)' };
  } else {
    const ms = Array.from({ length: n + 1 }, (_, k) => k), x = linspace(0, 1, GRID_N), nullPdf = (f) => phi((f - p0) / sd0) / sd0;
    series = [
      { id: 'null-sim', kind: 'pmf', tone: 'default', label: `simulated $m/n$ under $H_0$ ($R = ${R}$)`, x: ms.map((k) => k / n), y: sim.counts.map((c) => c / R * n) },
      { id: 'null-pmf', kind: 'pmf', tone: 'muted', label: 'exact $\\mathrm{Bin}(n, p_0) \\cdot n$', x: ms.map((k) => k / n), y: ms.map((k) => binomialPmf(k, n, p0) * n) },
      { id: 'null-pdf', kind: 'pdf', tone: 'signal', label: 'normal approximation', x, y: x.map(nullPdf) },
      ...criticalBands(fRegion, nullPdf, 0, 1),
    ];
    axes = { x: 'relative frequency $m/n$ under $H_0$', y: 'density (probability $\\times\\, n$)' };
  }
  return { readouts, series, notes, axes };
}

// ---------------------------------------------------------------- Mean station
const D_GRID_THEORY = linspace(-1.5, 1.5, 61), D_GRID_MC = linspace(-1.5, 1.5, 31);
function runMean({ sigmaKnown, mu, n, alpha, tail: ti, R, view }, seed) {
  const tail = tailOf(ti), known = sigmaKnown === 1;
  const dist = known ? { kind: 'z' } : { kind: 't', df: n - 1 }, region = criticalRegion(dist, alpha, tail);
  const x = Array.from({ length: n }, (_, i) => mu + gauss(seed, STREAM.ownMean, i));
  const own = meanTest(x, 0, alpha, tail, known ? 1 : null);
  const power = (d) => (known ? zPower(d, n, alpha, tail) : tPower(d, n, alpha, tail));
  const theory = power(mu), isNull = Math.abs(mu) < 1e-12;
  const sim = simulateMean({ n, R, seed, sigmaKnown: known, alpha, tail, grid: [0, mu], keepStats: view === 2 });
  const statName = known ? 'U' : 'T', k = n - 1, delta = mu * Math.sqrt(n);
  const critical = known ? zQ(tail === 'two' ? 1 - alpha / 2 : 1 - alpha) : studentTQuantile(tail === 'two' ? 1 - alpha / 2 : 1 - alpha, k);
  const readouts = [
    { key: 'statistic', label: known ? 'Your sample: $U = \\dfrac{(\\bar{x} - a_0)\\sqrt{n}}{\\sigma}$ (3)' : 'Your sample: $T = \\dfrac{(\\bar{x} - a_0)\\sqrt{n}}{s}$ (5)', observed: own.stat, theory: null,
      convention: `$\\bar{x} = ${fmt(own.xbar)}$${known ? ', $\\sigma = 1$ known' : `, $s = ${fmt(own.s)}$ (corrected, divisor $n - 1$)`}; $n = ${n}$, true $M(X) = ${mu}$` },
    { key: 'critical', label: known ? `Critical value $u_{\\mathrm{cr}}$, ${tailText[tail]}` : `Critical point $t_{\\mathrm{cr}}(\\alpha, k = ${k})$, ${tailText[tail]}`, observed: null, theory: critical,
      convention: known ? (tail === 'two' ? `$\\Phi_0(u_{\\mathrm{cr}}) = \\dfrac{1 - \\alpha}{2} = ${fmt((1 - alpha) / 2)}$ (Laplace function from 0)` : `$\\Phi_0(u_{\\mathrm{cr}}) = \\dfrac{1 - 2\\alpha}{2} = ${fmt((1 - 2 * alpha) / 2)}$`)
        : `computed Student quantile $t(${tail === 'two' ? '1 - \\alpha/2' : '1 - \\alpha'};\\, ${k})$, not a table value` },
    { key: 'decision', label: `Decision at $\\alpha = ${alpha}$`, observed: decisionText(own.reject), theory: null, convention: `$p$-value ${fmt(own.pValue)}` },
    ...powerReadouts({ R, hits: sim.hits[1], theory, nullHits: sim.hits[0], size: alpha, alpha, isNull,
      exactLabel: known ? 'is $1 - \\Phi(u_{\\mathrm{cr}} - \\delta)$ (and the mirrored tail), $\\delta = (\\mu - a_0)\\sqrt{n}/\\sigma$' : `is the noncentral $t$ with $\\delta = ${fmt(delta, 3)}$, by numerical integration` }),
  ];
  if (!known) readouts.push({ key: 'z-vs-t', label: 'Power if $\\sigma$ were known ($z$-test)', observed: null, theory: zPower(mu, n, alpha, tail), convention: 'estimating $\\sigma$ costs power at small $n$' });
  const notes = [
    known ? 'L12 formula (3): with $\\sigma$ known, $U = (\\bar{x} - a_0)\\sqrt{n}/\\sigma$ is exactly $N(0, 1)$ under $H_0$ for normal data.'
      : `L12 formula (4)–(5): with $\\sigma$ unknown, $T = (\\bar{x} - a_0)\\sqrt{n}/s$ has Student's law with $k = n - 1 = ${k}$ degrees of freedom under $H_0$.`,
    'The critical value is a computed quantile, so the type I error equals $\\alpha$ exactly; the simulated rejection rate under $H_0$ falls inside its 99.9% band in all but about 1 run in 1000.',
    known ? 'Under $H_1$ the statistic is $N(\\delta, 1)$, $\\delta = (\\mu - a_0)\\sqrt{n}/\\sigma$, so the power has a closed form.'
      : 'Under $H_1$ the statistic has the noncentral $t$ law; its power is computed by one integral over the $\\chi^2$ of $s$ and checked by simulation.',
    'The power curve reuses the same simulated draws for every true mean (common random numbers), so neighbouring points are correlated.',
  ];
  let series, axes;
  if (view === 0 || view === 2) {
    const x0 = Math.min(-5, delta - 5), x1 = Math.max(5, delta + 5), xs = linspace(x0, x1, GRID_N);
    const nullPdf = known ? phi : (t) => Math.exp(logGamma((k + 1) / 2) - logGamma(k / 2) - 0.5 * Math.log(k * Math.PI) - (k + 1) / 2 * Math.log1p(t * t / k));
    const altPdf = known ? (t) => phi(t - delta) : (t) => nctPdf(t, k, delta);
    if (view === 0) {
      series = [
        { id: 'null-pdf', kind: 'pdf', tone: 'signal', label: known ? '$H_0$: $N(0, 1)$' : `$H_0$: Student $t$, $k = ${k}$`, x: xs, y: xs.map(nullPdf) },
        ...criticalBands(region, nullPdf, x0, x1),
        { id: 'alt-pdf', kind: 'pdf', tone: 'default', label: known ? `true $\\mu = ${mu}$: $N(\\delta, 1)$` : `true $\\mu = ${mu}$: noncentral $t$, $\\delta = ${fmt(delta, 2)}$`, x: xs, y: xs.map(altPdf) },
        betaBand(region, altPdf, x0, x1),
        { id: 'observed', kind: 'rule', tone: 'default', label: `your $${statName} = ${fmt(own.stat, 3)}$`, x: [Math.min(x1, Math.max(x0, own.stat))], y: [0] },
      ];
    } else {
      const h = nullHistogram(sim.stats, -5, 5), xn = linspace(-5, 5, GRID_N);
      series = [
        { id: 'null-sim', kind: 'hist', tone: 'default', label: `simulated $${statName}$ under $H_0$ ($R = ${R}$)`, x: h.x, y: h.y },
        { id: 'null-pdf', kind: 'pdf', tone: 'signal', label: known ? '$N(0, 1)$' : `Student $t$, $k = ${k}$`, x: xn, y: xn.map(nullPdf) },
        ...criticalBands(region, nullPdf, -5, 5),
      ];
    }
    axes = { x: `statistic $${statName}$`, y: 'density' };
  } else {
    const mc = simulateMean({ n, R, seed, sigmaKnown: known, alpha, tail, grid: D_GRID_MC });
    series = powerSeries(D_GRID_THEORY, D_GRID_THEORY.map(power), D_GRID_MC, D_GRID_MC.map(power), mc.hits, R, mu, alpha);
    if (!known) series.push({ id: 'power-z', kind: 'line', tone: 'muted', label: '$z$-test power ($\\sigma$ known)', x: D_GRID_THEORY, y: D_GRID_THEORY.map((d) => zPower(d, n, alpha, tail)) });
    axes = { x: 'true mean $\\mu$ ($a_0 = 0$, $\\sigma = 1$)', y: '$P(\\text{reject } H_0)$ = power ($\\alpha$ at $\\mu = a_0$)' };
  }
  return { readouts, series, notes, axes };
}

// ---------------------------------------------------------------- Variances station
const RHO_GRID_THEORY = Array.from({ length: 61 }, (_, i) => 2 ** (-2 + 4 * i / 60)), RHO_GRID_MC = Array.from({ length: 25 }, (_, i) => 2 ** (-2 + 4 * i / 24));
function runVariances({ rho, n1, n2, alpha, tail: ti, R, view }, seed) {
  const tail = tailOf(ti), k1 = n1 - 1, k2 = n2 - 1;
  const xs = Array.from({ length: n1 }, (_, i) => Math.sqrt(rho) * gauss(seed, STREAM.ownX, i));
  const ys = Array.from({ length: n2 }, (_, i) => gauss(seed, STREAM.ownY, i));
  const own = fTest(xs, ys, alpha, tail), region = own.regionXY;
  const theory = fPower(rho, k1, k2, alpha, tail), isNull = Math.abs(rho - 1) < 1e-12;
  const sim = simulateVariances({ n1, n2, R, seed, alpha, tail, grid: [1, rho], keepStats: view === 2 });
  const lectureSize = fPower(1, k1, k2, alpha, tail, { lectureRule: true });
  const readouts = [
    { key: 'statistic', label: tail === 'two' ? 'Your samples: $F = s^2_{\\text{larger}} / s^2_{\\text{smaller}}$ (6)' : tail === 'right' ? 'Your samples: $F = s^2_X / s^2_Y$ ($H_1\\colon D(X) > D(Y)$)' : 'Your samples: $F = s^2_Y / s^2_X$ ($H_1\\colon D(X) < D(Y)$)',
      observed: own.F, theory: null, convention: `$s^2_X = ${fmt(own.s2x)}$ ($n_1 = ${n1}$), $s^2_Y = ${fmt(own.s2y)}$ ($n_2 = ${n2}$); df (${own.df1}, ${own.df2}), numerator's first; true $\\rho = ${rho}$` },
    { key: 'critical', label: `Critical point $F_{\\mathrm{cr}}$, ${tailText[tail]}`, observed: null, theory: own.critical,
      convention: tail === 'two' ? `$F(1 - \\alpha/2;\\, ${own.df1}, ${own.df2})$: two-sided uses $\\alpha/2 = ${alpha / 2}$` : `$F(1 - \\alpha;\\, ${own.df1}, ${own.df2})$` },
    { key: 'decision', label: `Decision at $\\alpha = ${alpha}$`, observed: decisionText(own.reject), theory: null, convention: `$p$-value ${fmt(own.pValue)}` },
    ...powerReadouts({ R, hits: sim.hits[1], theory, nullHits: sim.hits[0], size: alpha, alpha, isNull, exactLabel: 'is $P\\bigl(\\rho F(k_1, k_2) \\in \\text{critical region}\\bigr)$, exact' }),
  ];
  if (tail !== 'two') {
    const b = acceptanceBand(R, lectureSize, BAND_LEVEL);
    readouts.push({ key: 'lecture-rule', label: 'Lecture rule for one-sided $H_1$ (larger over smaller, $\\alpha$): type I error', observed: sim.lectureRuleHits[0] / R, theory: lectureSize,
      convention: `${sim.lectureRuleHits[0]}/${R}; 99.9% band ${fmt(b.lo / R, 3)}–${fmt(b.hi / R, 3)}. It also rejects when the other sample has the larger $s^2$, so its size is $2\\alpha$, not $\\alpha$` });
  }
  const notes = [
    'L12 formula (6): for normal samples $s^2_X/s^2_Y$ divided by $D(X)/D(Y)$ has the Fisher–Snedecor law with $k_1 = n_1 - 1$ and $k_2 = n_2 - 1$ degrees of freedom.',
    'Two-sided: the larger $s^2$ goes on top with its own df first, and the critical point is $F(1 - \\alpha/2)$: this is the same test as the equal-tailed region on $s^2_X/s^2_Y$ drawn on the chart.',
    'One-sided $H_1\\colon D(X) > D(Y)$ must use $s^2_X/s^2_Y$ in that order. Putting the larger $s^2$ on top regardless of $H_1$ doubles the type I error (lecture-rule readout).',
    'The chart is drawn on the ratio $s^2_X/s^2_Y$; under $H_1$ the ratio is $\\rho F(k_1, k_2)$, so the power is exact.',
  ];
  let series, axes;
  const nullPdf = (v) => (v <= 0 ? 0 : Math.exp(0.5 * (k1 * Math.log(k1) + k2 * Math.log(k2)) + (k1 / 2 - 1) * Math.log(v) - (k1 + k2) / 2 * Math.log(k2 + k1 * v) - (logGamma(k1 / 2) + logGamma(k2 / 2) - logGamma((k1 + k2) / 2))));
  if (view === 0 || view === 2) {
    const top = fisherQuantile(0.995, k1, k2) * (view === 0 ? Math.max(1, rho) : 1), x1 = Math.max(3, Math.min(40, top)), xg = linspace(0, x1, GRID_N);
    if (view === 0) {
      const altPdf = (v) => nullPdf(v / rho) / rho;
      series = [
        { id: 'null-pdf', kind: 'pdf', tone: 'signal', label: `$H_0$ ($\\rho = 1$): $F(${k1}, ${k2})$`, x: xg, y: xg.map(nullPdf) },
        ...criticalBands(region, nullPdf, 0, x1),
        { id: 'alt-pdf', kind: 'pdf', tone: 'default', label: `true $\\rho = ${rho}$: $\\rho F(${k1}, ${k2})$`, x: xg, y: xg.map(altPdf) },
        betaBand(region, altPdf, 0, x1),
        { id: 'observed', kind: 'rule', tone: 'default', label: `your $s^2_X/s^2_Y = ${fmt(own.ratio, 3)}$`, x: [Math.min(x1, own.ratio)], y: [0] },
      ];
    } else {
      const h = nullHistogram(sim.stats, 0, x1);
      series = [
        { id: 'null-sim', kind: 'hist', tone: 'default', label: `simulated $s^2_X/s^2_Y$ under $H_0$ ($R = ${R}$)`, x: h.x, y: h.y },
        { id: 'null-pdf', kind: 'pdf', tone: 'signal', label: `$F(${k1}, ${k2})$`, x: xg, y: xg.map(nullPdf) },
        ...criticalBands(region, nullPdf, 0, x1),
      ];
    }
    axes = { x: 'ratio $s^2_X / s^2_Y$', y: 'density' };
  } else {
    const mc = simulateVariances({ n1, n2, R, seed, alpha, tail, grid: RHO_GRID_MC });
    const pw = (r) => fPower(r, k1, k2, alpha, tail);
    series = powerSeries(RHO_GRID_THEORY, RHO_GRID_THEORY.map(pw), RHO_GRID_MC, RHO_GRID_MC.map(pw), mc.hits, R, rho, alpha);
    if (tail !== 'two') series.push({ id: 'power-lecture', kind: 'line', tone: 'muted', label: 'lecture one-sided rule (larger over smaller)', x: RHO_GRID_THEORY, y: RHO_GRID_THEORY.map((r) => fPower(r, k1, k2, alpha, tail, { lectureRule: true })) });
    else series.push({ id: 'power-lecture', kind: 'line', tone: 'muted', label: 'lecture rule (same as two-sided)', x: RHO_GRID_THEORY, y: RHO_GRID_THEORY.map((r) => fPower(r, k1, k2, alpha, tail)) });
    axes = { x: 'true ratio $\\rho = D(X)/D(Y)$', y: '$P(\\text{reject } H_0)$ = power ($\\alpha$ at $\\rho = 1$)' };
  }
  return { readouts, series, notes, axes };
}
