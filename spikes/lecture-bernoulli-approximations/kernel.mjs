// Lecture kernel for L3 and L9 (#39): the Bernoulli scheme. The exact binomial law (in log space), the most probable
// number, the local and integral de Moivre–Laplace approximations (with and without the continuity correction), the
// Poisson approximation, and the number of trials that pins a frequency down to ±ε with confidence γ.
// Pure ES module: no DOM. Randomness only from fixtureUint32 (fixture-mix32-v1).
// Research: docs/research/lecture-bernoulli-approximations.md. Fixtures: spikes/lecture-worked-examples-audit.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import { normalCdf, normalQuantile, logGamma } from '../lecture-special-functions/special.mjs';

const NAMESPACE = 0xbe39;
/** Uniform on (0, 1), never 0 or 1. */
const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i, NAMESPACE) + 0.5) / 2 ** 32;
const SQRT2PI = Math.sqrt(2 * Math.PI);
const r6 = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(6)));
const fmt = (v, d = 4) => String(Number(Number(v).toFixed(d)));
/** Plain decimals for formulas: up to 4 significant digits, no exponent for the values shown here. */
const d4 = (v) => {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 1e-4) { const [m, e] = v.toExponential(3).split('e'); return `${Number(m)} \\cdot 10^{${Number(e)}}`; }
  return String(Number(v.toPrecision(4)));
};

// ---------------------------------------------------------------- exact law
const LN_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);
const LOG_FACT = [0];
for (let j = 1; j <= 15; j++) LOG_FACT[j] = LOG_FACT[j - 1] + Math.log(j);
/** Stirling's error log(n!) − [(n + ½) log n − n + log √(2π)] (Loader 2000). */
function stirlerr(n) {
  if (n <= 15) return n === 0 ? 1 - LN_SQRT_2PI : LOG_FACT[n] - (n + 0.5) * Math.log(n) + n - LN_SQRT_2PI;
  const nn = n * n;
  return (1 / 12 - (1 / 360 - (1 / 1260 - (1 / 1680 - 1 / (1188 * nn)) / nn) / nn) / nn) / n;
}
/** Deviance term x log(x/m) + m − x, summed as a series when x is close to m (no cancellation). */
function bd0(x, m) {
  if (Math.abs(x - m) < 0.1 * (x + m)) {
    const v = (x - m) / (x + m);
    let s = (x - m) * v, ej = 2 * x * v;
    for (let j = 1; j < 1000; j++) {
      ej *= v * v;
      const s1 = s + ej / (2 * j + 1);
      if (s1 === s) return s1;
      s = s1;
    }
  }
  return x * Math.log(x / m) + m - x;
}
/**
 * P_n(k) = C(n, k) p^k q^(n−k) by Loader's saddle-point form: every factor is a logarithm of order one, so the
 * value keeps full relative precision for n = 10⁴ and beyond (no factorials, no underflow of p^k on the way).
 */
export function binomialPmf(n, p, k) {
  if (!Number.isInteger(k) || k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  const q = 1 - p;
  if (k === 0) return Math.exp(n * Math.log1p(-p));
  if (k === n) return Math.exp(n * Math.log(p));
  const lc = stirlerr(n) - stirlerr(k) - stirlerr(n - k) - bd0(k, n * p) - bd0(n - k, n * q);
  const lf = Math.log(2 * Math.PI) + Math.log(k) + Math.log1p(-k / n);
  return Math.exp(lc - 0.5 * lf);
}
/** The whole law P_n(0..n). */
export function binomialLaw(n, p) {
  return Array.from({ length: n + 1 }, (_, k) => binomialPmf(n, p, k));
}
/** P(lo ≤ k ≤ hi) summed from the exact law. */
export const binomialRange = (law, lo, hi) => {
  let s = 0;
  for (let k = Math.max(0, Math.ceil(lo)); k <= Math.min(law.length - 1, Math.floor(hi)); k++) s += law[k];
  return s;
};

/**
 * The most probable number (L3, formula 13): np − q ≤ k₀ ≤ np + p. The interval has length 1, so there is one
 * integer in it, or two when (n + 1)p is an integer (then both ends are modes with equal probability).
 */
export function mostProbable(n, p) {
  const top = (n + 1) * p;
  const near = Math.round(top);
  if (Math.abs(top - near) < 1e-9 && near >= 1 && near <= n) return [near - 1, near];
  return [Math.min(n, Math.floor(top))];
}

// ---------------------------------------------------------------- approximations
/** Local de Moivre–Laplace: P_n(k) ≈ φ(x)/√(npq), x = (k − np)/√(npq). */
export function localNormal(n, p, k) {
  const s = Math.sqrt(n * p * (1 - p));
  const x = (k - n * p) / s;
  return Math.exp(-0.5 * x * x) / (SQRT2PI * s);
}
/** Integral de Moivre–Laplace with Φ the CDF from −∞; `cc` adds the continuity correction ±1/2. */
export function integralNormal(n, p, lo, hi, cc = false) {
  const s = Math.sqrt(n * p * (1 - p)), m = n * p;
  const a = cc ? lo - 0.5 : lo, b = cc ? hi + 0.5 : hi;
  return normalCdf((b - m) / s) - normalCdf((a - m) / s);
}
/** Poisson: P_n(k) ≈ λ^k e^(−λ)/k!, λ = np. */
export function poissonPmf(lambda, k) {
  if (k < 0) return 0;
  return Math.exp(k * Math.log(lambda) - lambda - logGamma(k + 1));
}

/** The number of trials for |k/n − p| ≤ ε with probability γ: the normal design with the exact quantile, and Chebyshev's. */
export function frequencySize(p, eps, gamma) {
  const z = normalQuantile((1 + gamma) / 2);
  const pq = p * (1 - p);
  return { z, normal: Math.ceil((z * z * pq) / (eps * eps) - 1e-9), normalExact: (z * z * pq) / (eps * eps), chebyshev: Math.ceil(pq / ((1 - gamma) * eps * eps) - 1e-9) };
}

// ---------------------------------------------------------------- draws
/** R seeded counts of successes in n trials, by inversion of the exact CDF: one uniform per series (stream 1). */
export function drawCounts(law, R, seed, stream = 1) {
  const cdf = new Float64Array(law.length);
  let c = 0;
  for (let k = 0; k < law.length; k++) { c += law[k]; cdf[k] = c; }
  const out = new Int32Array(R);
  for (let r = 0; r < R; r++) {
    const u = uni(seed, stream, r) * c;
    let lo = 0, hi = law.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < u) lo = mid + 1; else hi = mid; }
    out[r] = lo;
  }
  return out;
}

// ---------------------------------------------------------------- trials machine (#115)
export const MACHINE_ROWS = 18;
export const MACHINE_CELLS = 120;
/**
 * The rows of the trials machine: the first MACHINE_ROWS series, each as its count k and its n trials. Given k, the
 * places of the k successes are uniform among the n trials (stream 3, Floyd's sampling), which is exactly the law of a
 * Bernoulli row conditioned on its count. Long rows are folded into at most MACHINE_CELLS cells holding the share of
 * successes in each.
 */
export function machineRows(counts, n, seed, rows = MACHINE_ROWS) {
  const cells = Math.min(n, MACHINE_CELLS);
  const out = [];
  for (let r = 0; r < Math.min(rows, counts.length); r++) {
    const k = counts[r];
    const chosen = new Set();
    for (let j = n - k; j < n; j++) {
      const t = Math.floor(uni(seed, 3 + 2 * r, j) * (j + 1));
      chosen.add(chosen.has(t) ? j : t);
    }
    const share = new Array(cells).fill(0);
    for (const pos of chosen) share[Math.floor((pos * cells) / n)] += cells / n;
    out.push({ k, cells: share.map((v) => Number(v.toFixed(4))) });
  }
  return out;
}

// ---------------------------------------------------------------- stations
const VIEW = { key: 'view', label: 'Show (0 the law and its approximations, 1 how many trials pin the frequency)', min: 0, max: 1, step: 1, default: 0 };
const params = [
  VIEW,
  { key: 'n', label: 'Trials $n$', min: 1, max: 10000, step: 1, default: 5000 },
  { key: 'p', label: 'Success probability $p$', min: 0.001, max: 0.999, step: 0.001, default: 0.01 },
  { key: 'k', label: 'Number of successes $k$ for $P_n(k)$', min: 0, max: 10000, step: 1, default: 50, when: { view: [0] } },
  { key: 'lo', label: 'Interval from $k_1$', min: 0, max: 10000, step: 1, default: 0, when: { view: [0] } },
  { key: 'hi', label: 'Interval to $k_2$', min: 0, max: 10000, step: 1, default: 50, when: { view: [0] } },
  { key: 'eps', label: 'Accuracy $\\varepsilon$ of the frequency', min: 0.001, max: 0.2, step: 0.001, default: 0.01, when: { view: [1] } },
  { key: 'gamma', label: 'Confidence $\\gamma$', min: 0.5, max: 0.999, step: 0.001, default: 0.98, when: { view: [1] } },
  { key: 'R', label: 'Series $R$ of $n$ trials', min: 50, max: 20000, step: 50, default: 4000 },
];

export const meta = {
  id: 'lecture-bernoulli-approximations',
  lectures: ['L3', 'L9'],
  title: 'The Bernoulli scheme: the exact binomial law against the de Moivre–Laplace and Poisson approximations',
  params,
};
export const stations = Object.freeze({ bernoulli: { params, live: true } });

const MAX_POINTS = 401;
export const MAX_DESIGN = 200000;
/** The k window drawn: the bulk of the exact law and of its approximations, at most MAX_POINTS wide. */
function window(n, p, extra = []) {
  const m = n * p, s = Math.sqrt(n * p * (1 - p));
  let lo = Math.max(0, Math.floor(Math.min(m - 5 * s - 2, m - 3 * Math.sqrt(m) - 2))), hi = Math.min(n, Math.ceil(Math.max(m + 5 * s + 2, m + 4 * Math.sqrt(m) + 3)));
  for (const v of extra) if (v >= 0 && v <= n) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (hi - lo + 1 > MAX_POINTS) { const c = Math.round(m); lo = Math.max(0, c - 200); hi = Math.min(n, lo + MAX_POINTS - 1); }
  return [lo, hi];
}

function runLaw({ n, p, k, lo, hi, R }, seed) {
  k = Math.min(k, n); lo = Math.min(lo, n); hi = Math.min(Math.max(hi, lo), n);
  const q = 1 - p, s = Math.sqrt(n * p * q), lambda = n * p;
  const law = binomialLaw(n, p);
  const counts = drawCounts(law, R, seed);
  const freq = new Float64Array(n + 1);
  for (const c of counts) freq[c] += 1 / R;
  const [a, b] = window(n, p, [k]);
  const ks = Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const local = ks.map((j) => localNormal(n, p, j)), pois = ks.map((j) => poissonPmf(lambda, j));
  // Largest errors over the whole law, not only the drawn window.
  let maxLocal = 0, maxPois = 0;
  for (let j = 0; j <= n; j++) {
    maxLocal = Math.max(maxLocal, Math.abs(law[j] - localNormal(n, p, j)));
    maxPois = Math.max(maxPois, Math.abs(law[j] - poissonPmf(lambda, j)));
  }
  const exactK = law[k], localK = localNormal(n, p, k), poisK = poissonPmf(lambda, k);
  const exactI = binomialRange(law, lo, hi), plain = integralNormal(n, p, lo, hi), corrected = integralNormal(n, p, lo, hi, true);
  let simI = 0;
  for (const c of counts) if (c >= lo && c <= hi) simI++;
  simI /= R;
  const band = 4 * Math.sqrt(Math.max(exactI * (1 - exactI), 1 / R) / R);
  const modes = mostProbable(n, p);
  let topSim = 0;
  for (let j = 1; j <= n; j++) if (freq[j] > freq[topSim]) topSim = j;
  const err = (v, e) => `error $${d4(Math.abs(v - e))}$`;
  const readouts = [
    { key: 'mode', label: 'Most probable number $k_0$, $np - q \\le k_0 \\le np + p$', observed: topSim, theory: modes.join(' and '),
      convention: modes.length === 2 ? '$(n + 1)p$ is an integer: two modes with equal probability' : `$${d4(n * p - q)} \\le k_0 \\le ${d4(n * p + p)}$` },
    { key: 'pk', label: `$P_n(k)$ at $k = ${k}$`, observed: r6(freq[k]), theory: r6(exactK), convention: 'exact Bernoulli formula; observed share of the series' },
    { key: 'local', label: 'Local de Moivre–Laplace $\\dfrac{\\varphi(x)}{\\sqrt{npq}}$', observed: null, theory: r6(localK), convention: err(localK, exactK) },
    { key: 'poisson', label: 'Poisson $\\dfrac{\\lambda^k e^{-\\lambda}}{k!}$, $\\lambda = np$', observed: null, theory: r6(poisK), convention: err(poisK, exactK) },
    { key: 'range', label: `$P(${lo} \\le k \\le ${hi})$`, observed: r6(simI), theory: r6(exactI), convention: `exact sum; ± ${fmt(band, 4)} (4 SE); ${Math.abs(simI - exactI) <= band ? 'inside' : 'outside'}` },
    { key: 'plain', label: 'Integral theorem $\\Phi(x_2) - \\Phi(x_1)$', observed: null, theory: r6(plain), convention: `$\\Phi$: CDF from $-\\infty$; ${err(plain, exactI)}` },
    { key: 'corrected', label: 'With the continuity correction $k \\pm \\tfrac12$', observed: null, theory: r6(corrected), convention: `$\\Phi$: CDF from $-\\infty$; ${err(corrected, exactI)}` },
    { key: 'maxLocal', label: '$\\max_k |P_n(k) - \\text{local normal}|$', observed: null, theory: r6(maxLocal) },
    { key: 'maxPoisson', label: '$\\max_k |P_n(k) - \\text{Poisson}|$', observed: null, theory: r6(maxPois) },
  ];
  const x = (j) => d4((j - n * p) / s);
  const formula = [
    `P_{${n}}(${k}) = C_{${n}}^{${k}}\\, ${d4(p)}^{${k}}\\, ${d4(q)}^{${n - k}} = ${d4(exactK)}`,
    `P_{${n}}(${k}) \\approx \\dfrac{\\varphi(x)}{\\sqrt{npq}} = \\dfrac{\\varphi(${x(k)})}{${d4(s)}} = ${d4(localK)}, \\qquad P_{${n}}(${k}) \\approx \\dfrac{${d4(lambda)}^{${k}}\\, e^{-${d4(lambda)}}}{${k}!} = ${d4(poisK)}`,
    `P(${lo} \\le k \\le ${hi}) = ${d4(exactI)} \\approx \\Phi(${x(hi)}) - \\Phi(${x(lo)}) = ${d4(plain)}`,
  ];
  const notes = [
    'L3: in $n$ independent trials with success probability $p$, $P_n(k) = C_n^k p^k q^{n-k}$. Each series of $n$ trials gives one count $k$; the bars are the shares of $R$ series.',
    'The local and integral de Moivre–Laplace theorems replace the law by the normal curve with $np$ and $\\sqrt{npq}$; they need $npq$ large. The Poisson formula keeps $\\lambda = np$ and fits when $p$ is small.',
    'The integral theorem here uses $\\Phi$, the CDF from $-\\infty$; tables with $\\Phi_0$ (from 0) give the same difference. Moving the ends by $\\tfrac12$ (continuity correction) usually closes most of the gap.',
  ];
  if (n * p * q < 9) notes.push(`$npq = ${d4(n * p * q)} < 9$: the normal approximations are rough here; compare their errors with Poisson's.`);
  return {
    readouts,
    series: [
      { id: 'sim', kind: 'hist', tone: 'muted', label: `shares of $R = ${R}$ series`, x: ks.map((j) => j - 0.5), y: ks.map((j) => freq[j]) },
      { id: 'exact', kind: 'pmf', tone: 'default', label: '$P_n(k)$ exact', x: ks, y: ks.map((j) => law[j]) },
      { id: 'local', kind: 'line', tone: 'signal', label: 'local normal $\\varphi(x)/\\sqrt{npq}$', x: ks, y: local },
      { id: 'poisson', kind: 'points', tone: 'accent', label: 'Poisson, $\\lambda = np$', x: ks, y: pois },
      { id: 'k', kind: 'rule', tone: 'muted', label: `$k = ${k}$`, x: [k], y: [0] },
    ],
    axes: { x: 'number of successes $k$', y: 'probability' },
    formula,
    notes,
    // #128: the exact sum, the integral theorem with the continuity correction, and the share of R series.
    meet: {
      label: `$P(${lo} \\le k \\le ${hi})$`,
      exact: { value: r6(exactI), label: 'exact Bernoulli sum', series: 'exact' },
      approx: { value: r6(corrected), label: 'integral theorem, $k \\pm \\tfrac12$', series: 'local' },
      sim: { value: r6(simI), label: `share of $R = ${R}$ series`, series: 'sim' },
    },
    machine: { n, p, rows: machineRows(counts, n, seed), window: [a, b], exact: ks.map((j) => r6(law[j])) },
  };
}

function runFrequency({ n, p, eps, gamma, R }, seed) {
  const size = frequencySize(p, eps, gamma);
  const N = Math.min(size.normal, MAX_DESIGN); // the simulated design: the normal size (capped for speed)
  const law = binomialLaw(N, p);
  const counts = drawCounts(law, R, seed, 2);
  // Frequencies k/N are discrete: draw the exact law and the shares of the series at the points k/N themselves.
  const half = Math.max(eps * 1.25, 4.5 * Math.sqrt((p * (1 - p)) / N));
  const [a, b] = [Math.max(0, Math.floor(N * (p - half))), Math.min(N, Math.ceil(N * (p + half)))];
  const shown = b - a + 1 > MAX_POINTS ? [Math.max(0, Math.round(N * p) - 200), Math.min(N, Math.round(N * p) + 200)] : [a, b];
  const ks = Array.from({ length: shown[1] - shown[0] + 1 }, (_, i) => shown[0] + i);
  const share = new Float64Array(N + 1);
  let inside = 0;
  for (const c of counts) {
    share[c] += 1 / R;
    if (Math.abs(c / N - p) <= eps + 1e-12) inside++;
  }
  const exactInside = binomialRange(law, N * (p - eps) - 1e-9, N * (p + eps) + 1e-9);
  const band = 4 * Math.sqrt(Math.max(exactInside * (1 - exactInside), 1 / R) / R);
  // The typed n, read as a design: the guarantee it gives.
  const guaranteeN = 2 * normalCdf((eps * Math.sqrt(n)) / Math.sqrt(p * (1 - p))) - 1;
  const readouts = [
    { key: 'normal', label: 'Trials for $\\varepsilon$ and $\\gamma$, normal design $n = \\dfrac{z^2 pq}{\\varepsilon^2}$', observed: null, theory: size.normal,
      convention: `exact quantile $z = ${d4(size.z)}$; continuous value ${fmt(size.normalExact, 2)}` },
    { key: 'chebyshev', label: 'Trials by Chebyshev $n = \\dfrac{pq}{(1 - \\gamma)\\varepsilon^2}$', observed: null, theory: size.chebyshev, convention: 'a guarantee for every law; much larger' },
    { key: 'inside', label: `$P(|k/n - p| \\le \\varepsilon)$ at $n = ${N}$`, observed: r6(inside / R), theory: r6(exactInside),
      convention: `${N < size.normal ? `design capped at ${MAX_DESIGN} trials; ` : ''}target $\\gamma = ${gamma}$; ± ${fmt(band, 4)} (4 SE); ${Math.abs(inside / R - exactInside) <= band ? 'inside' : 'outside'}` },
    { key: 'typed', label: `Typed $n = ${n}$ gives $2\\Phi\\!\\left(\\varepsilon\\sqrt{n/pq}\\right) - 1$`, observed: null, theory: r6(guaranteeN) },
  ];
  return {
    readouts,
    series: [
      { id: 'freq', kind: 'hist', tone: 'muted', label: `frequencies $k/n$ of $R = ${R}$ series, $n = ${N}$`, x: ks.map((j) => (j - 0.5) / N), y: ks.map((j) => share[j]) },
      { id: 'exact', kind: 'pmf', tone: 'default', label: '$P(k/n)$ exact', x: ks.map((j) => j / N), y: ks.map((j) => law[j]) },
      { id: 'lo', kind: 'rule', tone: 'signal', label: '$p \\pm \\varepsilon$', x: [p - eps], y: [0] },
      { id: 'hi', kind: 'rule', tone: 'signal', x: [p + eps], y: [0] },
      { id: 'p', kind: 'rule', tone: 'muted', label: '$p$', x: [p], y: [0] },
    ],
    axes: { x: 'frequency $k/n$', y: 'probability' },
    domain: { x: [(ks[0] - 0.5) / N, (ks[ks.length - 1] + 0.5) / N] },
    formula: [
      `P\\!\\left(\\left|\\dfrac{k}{n} - p\\right| \\le \\varepsilon\\right) \\approx 2\\Phi\\!\\left(\\varepsilon\\sqrt{\\dfrac{n}{pq}}\\right) - 1 = \\gamma \\;\\Rightarrow\\; n = \\dfrac{z^2 pq}{\\varepsilon^2} = \\dfrac{${d4(size.z)}^2 \\cdot ${d4(p * (1 - p))}}{${d4(eps)}^2} \\approx ${size.normal}`,
      `n_{\\text{Chebyshev}} = \\dfrac{pq}{(1 - \\gamma)\\,\\varepsilon^2} = ${size.chebyshev}`,
    ],
    notes: [
      'L3: the frequency $k/n$ of $n$ trials lands within $\\varepsilon$ of $p$ with probability about $2\\Phi(\\varepsilon\\sqrt{n/pq}) - 1$. Solving for $n$ gives the normal design; $z$ is the exact quantile $\\Phi^{-1}\\!\\left(\\tfrac{1 + \\gamma}{2}\\right)$, not a rounded table value.',
      'Chebyshev\'s inequality gives a guarantee that holds for any $n$, but it asks for many more trials. The bars are $R$ simulated series of the normal size; the share inside the band sits near $\\gamma$.',
    ],
  };
}

export function run(params = {}, { seed = 1, station = 'bernoulli' } = {}) {
  if (station !== 'bernoulli') throw new Error(`Unknown station ${station}.`);
  const q = Object.fromEntries(stations.bernoulli.params.map((d) => [d.key, Number.isFinite(params?.[d.key]) ? params[d.key] : d.default]));
  if (!Number.isInteger(q.n) || q.n < 1) throw new Error('n must be a positive integer.');
  if (!(q.p > 0 && q.p < 1)) throw new Error('p must lie strictly between 0 and 1.');
  for (const key of ['k', 'lo', 'hi', 'R']) if (!Number.isInteger(q[key]) || q[key] < 0) throw new Error(`${key} must be a whole number.`);
  return q.view === 1 ? runFrequency(q, seed >>> 0) : runLaw(q, seed >>> 0);
}
