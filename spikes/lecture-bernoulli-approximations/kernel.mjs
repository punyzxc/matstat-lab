// Lecture kernel (#39): the exact binomial law against the local and integral de Moivre–Laplace and
// Poisson approximations, the most probable number, and the sample size for a frequency (L3, L9).
// Contract: docs/research/lecture-module-map.md. No DOM; randomness only from fixtureUint32.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import { logBinomialRaw, logPoissonRaw } from '../statistical-engine/distributions.mjs';
import { normalCdf, normalQuantile, laplacePhi0, erf } from '../lecture-special-functions/special.mjs';

/** Predeclared Monte Carlo band: a simulated frequency must lie within BAND_Z standard errors. */
export const BAND_Z = 4;
/** Normal band only when the expected spread R·P(1−P) is at least this. */
export const MIN_SPREAD = 9;
export const MAX_N = 10_000;
const u01 = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;
const SQRT_2PI = Math.sqrt(2 * Math.PI);

// ---------- exact binomial law, in log space ----------
/** log P_n(k) = log C(n,k) + k log p + (n−k) log q, via Loader's saddle point (no lgamma cancellation). */
export function binomialLogPmf(n, p, k) {
  if (!Number.isInteger(k) || k < 0 || k > n) return -Infinity;
  const q = 1 - p;
  if (p === 0) return k === 0 ? 0 : -Infinity;
  if (p === 1) return k === n ? 0 : -Infinity;
  if (k === 0) return n * Math.log1p(-p);
  if (k === n) return n * Math.log(p);
  return logBinomialRaw(k, n, p, q);
}
/** The whole PMF 0..n as a Float64Array (n ≤ MAX_N). */
export function binomialPmf(n, p) {
  const out = new Float64Array(n + 1);
  for (let k = 0; k <= n; k++) out[k] = Math.exp(binomialLogPmf(n, p, k));
  return out;
}
/** Exact P(k1 ≤ k ≤ k2) by summing the PMF smallest terms first (k1, k2 clamped to 0..n). */
export function binomialInterval(pmf, k1, k2) {
  const lo = Math.max(0, Math.ceil(k1)), hi = Math.min(pmf.length - 1, Math.floor(k2));
  if (hi < lo) return 0;
  const terms = Array.from(pmf.subarray(lo, hi + 1)).sort((a, b) => a - b);
  let s = 0;
  for (const t of terms) s += t;
  return Math.min(1, s);
}

/**
 * Most probable number, formula (13) of L3: k₀ = [(n+1)p] if (n+1)p is not an integer; otherwise two
 * modes, (n+1)p − 1 and (n+1)p. p is read as an exact decimal fraction (up to 6 digits) so the integer
 * test is done in integers, not floats.
 */
export function mostProbable(n, p) {
  const den = 1_000_000, num = Math.round(p * den);
  if (Math.abs(num / den - p) > 1e-12) throw new RangeError('p must have at most 6 decimal digits');
  const t = (n + 1) * num; // (n+1)p = t / den, exact in safe integers for n ≤ 1e4
  if (num === 0) return { modes: [0], twoModes: false, np1p: 0 };
  if (num === den) return { modes: [n], twoModes: false, np1p: n + 1 };
  if (t % den === 0) { const m = t / den; return { modes: [m - 1, m], twoModes: true, np1p: m }; }
  return { modes: [Math.floor(t / den)], twoModes: false, np1p: t / den };
}

// ---------- the approximations ----------
const phi = (x) => Math.exp(-x * x / 2) / SQRT_2PI;
/** Local de Moivre–Laplace, formula (15): P_n(k) ≈ φ(x)/√(npq), x = (k − np)/√(npq). */
export const localApprox = (n, p, k) => { const s = Math.sqrt(n * p * (1 - p)); return phi((k - n * p) / s) / s; };
/** Integral de Moivre–Laplace, formula (17): P(k1 ≤ k ≤ k2) ≈ Φ(b) − Φ(a), Φ the CDF from −∞. */
export function integralApprox(n, p, k1, k2, continuity = false) {
  const s = Math.sqrt(n * p * (1 - p)), c = continuity ? 0.5 : 0;
  return normalCdf((k2 + c - n * p) / s) - normalCdf((k1 - c - n * p) / s);
}
/** Poisson, formula (18): P_n(k) ≈ λᵏe^(−λ)/k!, λ = np. */
export function poissonPmf(lambda, k) {
  if (!Number.isInteger(k) || k < 0) return 0;
  if (lambda === 0) return k === 0 ? 1 : 0;
  return k === 0 ? Math.exp(-lambda) : Math.exp(logPoissonRaw(k, lambda));
}
export function poissonInterval(lambda, k1, k2) {
  let s = 0;
  for (let k = Math.max(0, Math.ceil(k1)); k <= k2; k++) s += poissonPmf(lambda, k);
  return Math.min(1, s);
}

// ---------- sample size for a frequency (L3, formula 20) ----------
/** n so that P(|m/n − p| ≤ ε) ≥ γ: normal n = z²pq/ε² with z = Φ⁻¹((1+γ)/2); Chebyshev n = pq/((1−γ)ε²). */
export function sampleSize(eps, gamma, p) {
  const pq = p * (1 - p), z = normalQuantile((1 + gamma) / 2);
  return { z, normal: Math.ceil(z * z * pq / (eps * eps)), chebyshev: Math.ceil(pq / ((1 - gamma) * eps * eps)) };
}

// ---------- lecture examples as presets ----------
/** example: 0 = custom sliders; 1..7 = the worked examples of L3 and L9, with the lecture's printed answer. */
export const EXAMPLES = Object.freeze([
  null,
  { ref: 'L3 ex. 1', n: 7, p: 0.75, k1: 5, k2: 5, lecture: { exact: 0.311 }, note: 'The text says "each of five days" but computes n = 7, k = 5; the preset follows the formula.' },
  { ref: 'L3 ex. 2a', n: 5000, p: 0.01, k1: 50, k2: 50, lecture: { exact: 0.0572, local: 0.057 }, note: 'The lecture prints 0.0572 for the exact value; the exact value is 0.0566.' },
  { ref: 'L3 ex. 2b', n: 5000, p: 0.01, k1: 0, k2: 50, lecture: { exact: 0.5033, integral: 0.5 }, note: 'The lecture prints 0.5033 for the exact sum; the exact value is 0.5375. The plain integral formula gives 0.5; with continuity correction it is much closer.' },
  { ref: 'L3 typos', n: 100, p: 0.001, k1: 1, k2: 100, lecture: { poisson: 0.0952 }, note: 'At least one typo on a page: 1 − e^(−0.1) by Poisson; the exact value is 1 − 0.999¹⁰⁰.' },
  { ref: 'L9 ex. defects', n: 50, p: 0.2, k1: 6, k2: 50, lecture: { integral: 0.92135 }, note: 'L9 writes ½(Ф(16)+Ф(1)) with Ф(1) = 0.8427, i.e. erf(1); in the Φ-from-−∞ convention this is Φ(√2) = 0.9214.' },
  { ref: 'L9 ex. first grade', n: 200, p: 0.6, k1: 120, k2: 150, lecture: { integral: 0.5 }, note: 'The integral formula without continuity correction gives 0.5; the exact value is 0.5307.' },
  { ref: 'L9 ex. service life', n: 15000, p: 0.04, k1: 570, k2: 630, lecture: { integral: 0.7888 }, note: 'L9 uses 2Ф₀-type tables: 2·0.3944 = 0.7888; the exact value is 0.7963.' },
]);

// ---------- contract ----------
const params = [
  { key: 'view', label: 'View: 1 approximations, 2 sample size', min: 1, max: 2, step: 1, default: 1 },
  { key: 'example', label: 'Lecture example (0 = sliders)', min: 0, max: EXAMPLES.length - 1, step: 1, default: 3, when: { view: [1] } },
  { key: 'n', label: 'n, trials', min: 1, max: MAX_N, step: 1, default: 100, when: { view: [1], example: [0] } },
  { key: 'p', label: 'p, success probability', min: 0, max: 1, step: 0.001, default: 0.3, when: { view: [1], example: [0] } },
  { key: 'k1', label: 'k₁, interval start', min: 0, max: MAX_N, step: 1, default: 25, when: { view: [1], example: [0] } },
  { key: 'k2', label: 'k₂, interval end', min: 0, max: MAX_N, step: 1, default: 35, when: { view: [1], example: [0] } },
  { key: 'R', label: 'Simulated repetitions of the n trials', min: 100, max: 20000, step: 100, default: 2000, when: { view: [1] } },
  { key: 'eps', label: 'ε, allowed deviation of the frequency', min: 0.001, max: 0.2, step: 0.001, default: 0.01, when: { view: [2] } },
  { key: 'gamma', label: 'γ, confidence', min: 0.5, max: 0.999, step: 0.001, default: 0.98, when: { view: [2] } },
  { key: 'pFreq', label: 'p (0.5 is the worst case)', min: 0.001, max: 0.999, step: 0.001, default: 0.5, when: { view: [2] } },
];
export const meta = { id: 'lecture-bernoulli-approximations', lectures: ['L3', 'L9'], title: 'Bernoulli scheme: exact law, de Moivre–Laplace and Poisson', params };
export const stations = { bernoulli: { params } };

const band = (P, m) => (m * P * (1 - P) < MIN_SPREAD ? null : [Math.max(0, P - BAND_Z * Math.sqrt(P * (1 - P) / m)), Math.min(1, P + BAND_Z * Math.sqrt(P * (1 - P) / m))]);
const r = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(12)));

/** Seeded Bin(n, p) counts by inversion on the exact CDF: one uniform per repetition (stream 0). */
export function simulateCounts(pmf, R, seed) {
  const cdf = new Float64Array(pmf.length);
  let acc = 0;
  for (let k = 0; k < pmf.length; k++) { acc += pmf[k]; cdf[k] = acc; }
  const counts = [];
  for (let i = 0; i < R; i++) {
    const u = u01(seed, 0, i) * acc; // scale by the computed total so rounding never leaves u above the last step
    let lo = 0, hi = pmf.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] >= u) hi = mid; else lo = mid + 1; }
    counts.push(lo);
  }
  return counts;
}

function runApproximations(prm, seed) {
  const ex = EXAMPLES[prm.example];
  const n = ex ? ex.n : prm.n, p = ex ? ex.p : prm.p, R = prm.R;
  let k1 = ex ? ex.k1 : Math.min(prm.k1, n), k2 = ex ? ex.k2 : Math.min(prm.k2, n);
  if (k1 > k2) [k1, k2] = [k2, k1];
  const q = 1 - p, npq = n * p * q, lambda = n * p;
  const pmf = binomialPmf(n, p);
  const mode = mostProbable(n, p);
  // The point readout: k₁ itself for a single value, otherwise the most probable number clamped into [k₁, k₂].
  const kp = k1 === k2 ? k1 : Math.min(k2, Math.max(k1, mode.modes[0]));
  const exactPoint = pmf[kp], exactInt = binomialInterval(pmf, k1, k2);
  const normalOk = npq > 0;
  const local = normalOk ? localApprox(n, p, kp) : null;
  const intPlain = normalOk ? integralApprox(n, p, k1, k2, false) : null;
  const intCC = normalOk ? integralApprox(n, p, k1, k2, true) : null;
  const poisPoint = poissonPmf(lambda, kp), poisInt = poissonInterval(lambda, k1, k2);
  const counts = simulateCounts(pmf, R, seed);
  const hits = counts.filter((c) => c >= k1 && c <= k2).length;
  const sd = Math.sqrt(npq);
  const lo = Math.max(0, Math.floor(lambda - 8 * sd - 3)), hi = Math.min(n, Math.ceil(lambda + 8 * sd + 3));
  const ks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const freq = new Array(ks.length).fill(0);
  for (const c of counts) if (c >= lo && c <= hi) freq[c - lo] += 1 / R;
  const pointLabel = `P_n(${kp})`;
  const readouts = [
    { key: 'exactPoint', label: `${pointLabel}, exact (formula 11)`, theory: r(exactPoint), observed: r(counts.filter((c) => c === kp).length / R), band: band(exactPoint, R), convention: 'exact' },
    { key: 'local', label: `${pointLabel} ≈ φ(x)/√(npq), local de Moivre–Laplace (15)`, theory: r(local), error: local == null ? null : r(Math.abs(local - exactPoint)), convention: 'φ density' },
    { key: 'poissonPoint', label: `${pointLabel} ≈ λᵏe^(−λ)/k!, Poisson (18)`, theory: r(poisPoint), error: r(Math.abs(poisPoint - exactPoint)), convention: 'Poisson' },
    { key: 'exactInt', label: `P(${k1} ≤ k ≤ ${k2}), exact`, theory: r(exactInt), observed: r(hits / R), band: band(exactInt, R), convention: 'exact' },
    { key: 'integral', label: `P(${k1} ≤ k ≤ ${k2}) ≈ Φ(b) − Φ(a), integral de Moivre–Laplace (17)`, theory: r(intPlain), error: intPlain == null ? null : r(Math.abs(intPlain - exactInt)), convention: 'Φ (CDF from −∞)' },
    { key: 'integralCC', label: `same with continuity correction, Φ(b + 0.5/√npq) − Φ(a − 0.5/√npq)`, theory: r(intCC), error: intCC == null ? null : r(Math.abs(intCC - exactInt)), convention: 'Φ (CDF from −∞)' },
    { key: 'poissonInt', label: `P(${k1} ≤ k ≤ ${k2}) ≈ Σ Poisson`, theory: r(poisInt), error: r(Math.abs(poisInt - exactInt)), convention: 'Poisson' },
    { key: 'k0', label: mode.twoModes ? 'k₀, two most probable numbers ((n+1)p is an integer)' : 'k₀, most probable number (13)', theory: mode.modes.join(' and '), convention: '(n+1)p = ' + r(mode.np1p) },
  ];
  if (ex) {
    readouts.push({ key: 'lecture', label: `${ex.ref}: the lecture's printed values`, theory: Object.entries(ex.lecture).map(([k, v]) => `${k} ${v}`).join(', '), convention: 'lecture' });
  }
  const series = [
    { id: 'pmf', kind: 'pmf', tone: 'signal', label: 'exact P_n(k)', x: ks, y: ks.map((k) => r(pmf[k])) },
    { id: 'sim', kind: 'hist', tone: 'default', label: `simulated frequency, R = ${R}`, x: ks.map((k) => k - 0.5), y: freq.map(r) },
  ];
  if (normalOk) {
    const grid = Array.from({ length: 161 }, (_, i) => lo + (i * (hi - lo)) / 160);
    series.push({ id: 'local', kind: 'line', tone: 'accent', label: 'φ((k − np)/√npq)/√npq', x: grid.map(r), y: grid.map((x) => r(phi((x - lambda) / sd) / sd)) });
  }
  series.push({ id: 'poisson', kind: 'points', tone: 'muted', label: 'Poisson λᵏe^(−λ)/k!', x: ks, y: ks.map((k) => r(poissonPmf(lambda, k))) });
  series.push({ id: 'interval', kind: 'rule', tone: 'muted', label: 'k₁ and k₂', x: [k1, k2], y: [0, 0] });
  return {
    axes: { x: 'k, number of successes', y: 'probability' },
    readouts,
    series,
    notes: [
      'Bernoulli formula (11): $P_n(k) = C_n^k p^k q^{n-k}$, computed in log space; it sums to 1 within $10^{-12}$.',
      'Local theorem (15) uses the density $\\varphi$; integral theorem (17) uses $\\Phi(x) = \\int_{-\\infty}^x \\varphi$. The tables in L9 and L12 use $\\Phi_0(x) = \\Phi(x) - 0.5$ or $\\mathrm{erf}$; every readout names its convention.',
      'Poisson (18) is accurate when $p$ is small and $\\lambda = np$ is moderate; de Moivre–Laplace when $npq$ is large.',
      `Simulated frequencies come from ${R} seeded repetitions; bands are $\\pm${BAND_Z}$ standard errors, omitted when $R\\,P(1-P) < ${MIN_SPREAD}$.`,
      ...(ex ? [`${ex.ref}: ${ex.note}`] : []),
    ],
  };
}

function runSampleSize(prm) {
  const { eps, gamma, pFreq } = prm;
  const s = sampleSize(eps, gamma, pFreq);
  const table = eps === 0.01 && gamma === 0.98 && pFreq === 0.5 ? Math.ceil((2.3 / (2 * 0.01)) ** 2) : null;
  const gammas = Array.from({ length: 50 }, (_, i) => 0.5 + (i * 0.49) / 49);
  return {
    axes: { x: 'γ, confidence', y: 'n, trials' },
    readouts: [
      { key: 'z', label: 'z = Φ⁻¹((1 + γ)/2)', theory: r(s.z), convention: 'Φ (CDF from −∞)' },
      { key: 'nNormal', label: 'n from 2Φ(ε√(n/pq)) − 1 ≥ γ (formula 20)', theory: s.normal, convention: 'Φ (CDF from −∞)' },
      { key: 'nCheb', label: 'n from Chebyshev, pq/(nε²) ≤ 1 − γ', theory: s.chebyshev, convention: 'Chebyshev' },
      ...(table ? [{ key: 'lectureTable', label: 'L3 with the table value z = 2.3', theory: table, convention: 'lecture table (rounded z)' }] : []),
    ],
    series: [
      { id: 'normal', kind: 'line', tone: 'signal', label: 'normal approximation', x: gammas.map(r), y: gammas.map((g) => sampleSize(eps, g, pFreq).normal) },
      { id: 'cheb', kind: 'line', tone: 'muted', label: 'Chebyshev bound', x: gammas.map(r), y: gammas.map((g) => sampleSize(eps, g, pFreq).chebyshev) },
      { id: 'now', kind: 'rule', tone: 'accent', label: 'chosen γ', x: [gamma], y: [0] },
    ],
    notes: [
      'Formula (20): $P(|m/n - p| \\le \\varepsilon) \\approx 2\\Phi(\\varepsilon\\sqrt{n/(pq)}) - 1$; solved for $n$ with the exact quantile.',
      'Chebyshev needs no normal approximation, so its $n$ is always larger: here by a factor $1/((1-\\gamma) z^2)$.',
      ...(table ? [`L3 reads $z \\approx 2.3$ from the table and gets 13 225; the exact $z_{0.99} = ${s.z.toFixed(4)}$ gives ${s.normal}.`] : []),
    ],
  };
}

export function run(params = {}, { seed = 1 } = {}) {
  const prm = Object.fromEntries(meta.params.map((d) => [d.key, Number.isFinite(params?.[d.key]) ? params[d.key] : d.default]));
  return prm.view === 2 ? runSampleSize(prm) : runApproximations(prm, seed);
}

/** Named normal conventions, re-exported so a readout can show Φ, Φ₀ or erf explicitly. */
export const conventions = Object.freeze({ Phi: normalCdf, Phi0: laplacePhi0, erf });
