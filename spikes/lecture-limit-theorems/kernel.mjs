// Lecture kernel for L6–L9: sums of uniforms and their exact convolution (Convolution),
// the Chebyshev inequality, the law of large numbers and the Cauchy counterexample (Convergence),
// and the central limit theorem with the Poisson-lemma sum (CLT).
// Pure ES module: no DOM. Randomness only from fixtureUint32 (fixture-mix32-v1).
// Contract: docs/research/lecture-module-map.md; research: docs/research/lecture-limit-theorems.md.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import { normalCdf, kolmogorovQuantile } from '../lecture-special-functions/special.mjs';

/** Uniform on (0, 1), never 0 or 1, from one counter-based draw. */
const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;
const SQRT2PI = Math.sqrt(2 * Math.PI);
const normPdf = (z) => Math.exp(-0.5 * z * z) / SQRT2PI;
const r6 = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(6)));
const fmt = (v, d = 4) => Number(v).toFixed(d);
const grid = (lo, hi, count) => Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));

// ---------------------------------------------------------------- exact laws
function binom(n, k) {
  let c = 1;
  for (let j = 1; j <= k; j++) c = (c * (n - k + j)) / j;
  return c;
}
const factorial = (n) => { let f = 1; for (let j = 2; j <= n; j++) f *= j; return f; };

/** Irwin–Hall density of U₁ + … + Uₘ, Uᵢ ~ U(0, 1): (1/(m−1)!) Σₖ≤⌊x⌋ (−1)ᵏ C(m, k) (x − k)^(m−1). */
export function irwinHallPdf(x, m) {
  if (!(x >= 0 && x <= m)) return 0;
  if (m === 1) return 1;
  let s = 0;
  for (let k = 0; k <= Math.min(m, Math.floor(x)); k++) s += (k % 2 ? -1 : 1) * binom(m, k) * (x - k) ** (m - 1);
  return Math.max(0, s / factorial(m - 1));
}
/** Irwin–Hall CDF: (1/m!) Σₖ≤⌊x⌋ (−1)ᵏ C(m, k) (x − k)^m. */
export function irwinHallCdf(x, m) {
  if (x <= 0) return 0;
  if (x >= m) return 1;
  let s = 0;
  for (let k = 0; k <= Math.floor(x); k++) s += (k % 2 ? -1 : 1) * binom(m, k) * (x - k) ** m;
  return Math.min(1, Math.max(0, s / factorial(m)));
}

/** Σₖ₌₀ⁿ nᵏ e⁻ⁿ / k! = P(Poisson(n) ≤ n), summed in log space so n up to 10⁴ stays exact to double precision. */
export function poissonLemmaSum(n) {
  if (n === 0) return 1;
  let logTerm = -n, s = 0; // k = 0
  // Sum from the largest term down for accuracy: terms grow up to k = n.
  const terms = [];
  for (let k = 0; k <= n; k++) {
    if (k > 0) logTerm += Math.log(n) - Math.log(k);
    terms.push(logTerm);
  }
  for (let k = n; k >= 0; k--) s += Math.exp(terms[k]);
  return s;
}

/**
 * Laws for the Convergence and CLT stations. `tail(k)` is the exact P(|X − μ| ≥ kσ);
 * Cauchy has no mean or variance (μ, σ are its median and the half-width of the quartile range).
 */
const POISSON1 = Array.from({ length: 40 }, (_, j) => Math.exp(-1) / factorial(j));
export const LAWS = Object.freeze([
  { id: 'normal', label: 'Normal $N(0, 1)$', mean: 0, sd: 1,
    draw: (seed, s, i) => Math.sqrt(-2 * Math.log(uni(seed, s, i))) * Math.cos(2 * Math.PI * uni(seed, s + 7919, i)),
    tail: (k) => 2 * normalCdf(-k) },
  { id: 'uniform', label: 'Uniform $U(0, 1)$', mean: 0.5, sd: Math.sqrt(1 / 12),
    draw: (seed, s, i) => uni(seed, s, i),
    tail: (k) => Math.max(0, 1 - k / Math.sqrt(3)) },
  { id: 'exponential', label: 'Exponential, $\\lambda = 1$', mean: 1, sd: 1,
    draw: (seed, s, i) => -Math.log(uni(seed, s, i)),
    tail: (k) => Math.exp(-(1 + k)) + (k < 1 ? 1 - Math.exp(-(1 - k)) : 0) },
  { id: 'poisson', label: 'Poisson, $\\lambda = 1$', mean: 1, sd: 1, discrete: true,
    draw: (seed, s, i) => {
      let u = uni(seed, s, i), j = 0;
      while (j < POISSON1.length - 1 && u > POISSON1[j]) { u -= POISSON1[j]; j++; }
      return j;
    },
    tail: (k) => POISSON1.reduce((acc, p, j) => (Math.abs(j - 1) >= k - 1e-12 ? acc + p : acc), 0) },
  { id: 'cauchy', label: 'Cauchy, $F(x) = \\tfrac12 + \\tfrac{1}{\\pi}\\operatorname{arctg} x$', mean: null, sd: null,
    draw: (seed, s, i) => Math.tan(Math.PI * (uni(seed, s, i) - 0.5)),
    tail: (k) => 1 - (2 / Math.PI) * Math.atan(k) },
]);
const CLT_LAWS = [1, 2, 3, 0]; // uniform, exponential, Poisson(1), normal: all with finite variance

/** Kolmogorov distance sup |Fₙ(x) − F(x)| of a sample against a continuous CDF. */
export function kolmogorovDistance(values, cdf) {
  const x = Float64Array.from(values).sort();
  const n = x.length;
  let d = 0;
  for (let i = 0; i < n; i++) {
    const f = cdf(x[i]);
    d = Math.max(d, (i + 1) / n - f, f - i / n);
  }
  return d;
}
/** Predeclared Monte Carlo band for the Kolmogorov distance of R draws from the true law: λ with K(λ) = 1 − α, over √R. */
export const KS_LAMBDA = kolmogorovQuantile(1 - 0.001); // ≈ 1.949
export const ksBand = (R) => KS_LAMBDA / Math.sqrt(R);

// ---------------------------------------------------------------- Convolution station
/** R seeded sums of m uniforms. Term t of replicate r is draw (stream 100 + t, index r). */
export function uniformSums(m, R, seed) {
  const out = new Float64Array(R);
  for (let r = 0; r < R; r++) {
    let s = 0;
    for (let t = 0; t < m; t++) s += uni(seed, 100 + t, r);
    out[r] = s;
  }
  return out;
}
const CONV_LO = 0, CONV_HI = 6, CONV_BINS = 60; // fixed display range: the picture spreads as m grows

function runConvolution({ m, R }, seed) {
  const sums = uniformSums(m, R, seed);
  const w = (CONV_HI - CONV_LO) / CONV_BINS, counts = new Array(CONV_BINS).fill(0);
  for (const v of sums) { const k = Math.floor((v - CONV_LO) / w); if (k >= 0 && k < CONV_BINS) counts[k]++; }
  const xs = Array.from({ length: CONV_BINS }, (_, i) => CONV_LO + i * w);
  const fine = grid(CONV_LO, CONV_HI, 241);
  const mu = m / 2, sd = Math.sqrt(m / 12);
  const D = kolmogorovDistance(sums, (x) => irwinHallCdf(x, m));
  const band = ksBand(R);
  let gap = 0;
  for (const x of fine) gap = Math.max(gap, Math.abs(irwinHallPdf(x, m) - normPdf((x - mu) / sd) / sd));
  const readouts = [
    { key: 'ks', label: `Kolmogorov distance, simulated sums vs exact law`, observed: r6(D), theory: `$\\le ${fmt(band)}$`,
      convention: `99.9% band $\\lambda(0.001)/\\sqrt{R} = ${fmt(KS_LAMBDA, 3)}/\\sqrt{${R}}$; ${D <= band ? 'inside' : 'outside'} the band` },
    { key: 'mean', label: 'Mean of the sum', observed: r6(sums.reduce((a, b) => a + b, 0) / R), theory: r6(mu) },
    { key: 'var', label: 'Variance of the sum', observed: r6(sums.reduce((a, b) => a + (b - mu) ** 2, 0) / R), theory: r6(m / 12),
      convention: 'variances of independent terms add: $m/12$' },
    { key: 'gap', label: 'Largest gap, exact density vs normal $N(m/2,\\, m/12)$', observed: null, theory: r6(gap),
      convention: 'shrinks as m grows: the central limit theorem at work' },
  ];
  const pieces = m === 1 ? 'a constant 1 on $[0, 1]$' : m === 2 ? 'a triangle: $x$ on $[0, 1]$, $2 - x$ on $[1, 2]$'
    : m === 3 ? 'three parabolas: $\\dfrac{x^2}{2}$, $\\dfrac{-2x^2 + 6x - 3}{2}$, $\\dfrac{(3 - x)^2}{2}$' : `${m} polynomial pieces of degree ${m - 1}`;
  return {
    readouts,
    series: [
      { id: 'hist', kind: 'hist', tone: 'default', label: `simulated sums, $R = ${R}$`, x: xs, y: counts.map((c) => c / (R * w)) },
      { id: 'normal', kind: 'line', tone: 'muted', label: 'normal with the same mean and variance', x: fine, y: fine.map((x) => normPdf((x - mu) / sd) / sd) },
      { id: 'exact', kind: 'pdf', tone: 'signal', label: `exact density, $m = ${m}$`, x: fine, y: fine.map((x) => irwinHallPdf(x, m)) },
    ],
    axes: { x: `sum of $m = ${m}$ uniforms`, y: 'density' },
    notes: [
      `The density of a sum is the convolution of the densities (L6, formula 53). For $m = ${m}$ it is ${pieces}.`,
      'Each convolution smooths the curve: $m = 2$ has a corner, $m = 3$ is already smooth and close to the bell. This is the CLT seen before it is proved.',
    ],
  };
}

// ---------------------------------------------------------------- Convergence station (L7)
const CONV_PATHS = 5;
const PATH_POINTS = 120;
/** Running means of `paths` independent sequences; points on a log-spaced grid of n. */
export function runningMeans(law, N, seed, paths = CONV_PATHS) {
  const ns = [...new Set(grid(0, Math.log(N), PATH_POINTS).map((t) => Math.round(Math.exp(t))))];
  const out = [];
  for (let p = 0; p < paths; p++) {
    let s = 0, j = 0;
    const y = [];
    for (let n = 1; n <= N; n++) {
      s += law.draw(seed, 300 + 2 * p * 7919, n);
      if (n === ns[j]) { y.push(s / n); j++; }
    }
    out.push(y);
  }
  return { ns, paths: out };
}

function runConvergence({ law: li, k, N, view }, seed) {
  const law = LAWS[li];
  const cauchy = law.mean == null;
  if (view === 1) {
    const ks = grid(0.5, 4, 36);
    const R = 20000;
    let hits = 0;
    for (let i = 0; i < R; i++) {
      const v = law.draw(seed, 900, i);
      if (!cauchy && Math.abs(v - law.mean) >= k * law.sd - 1e-12) hits++;
      if (cauchy && Math.abs(v) >= k) hits++;
    }
    const exact = law.tail(k), se = Math.sqrt(exact * (1 - exact) / R);
    const series = [
      { id: 'tail', kind: 'line', tone: 'default', label: cauchy ? 'exact $P(|X| \\ge k)$' : 'exact $P(|X - MX| \\ge k\\sigma)$', x: ks, y: ks.map(law.tail) },
      { id: 'k', kind: 'rule', tone: 'muted', label: `$k = ${k}$`, x: [k], y: [0] },
    ];
    if (!cauchy) series.splice(1, 0, { id: 'bound', kind: 'line', tone: 'signal', label: 'Chebyshev bound $1/k^2$', x: ks, y: ks.map((t) => Math.min(1, 1 / (t * t))) });
    return {
      readouts: [
        { key: 'exact', label: cauchy ? `Exact $P(|X| \\ge ${k})$` : `Exact $P(|X - MX| \\ge ${k}\\sigma)$`, observed: r6(hits / R), theory: r6(exact),
          convention: exact > 0 ? `simulated with $R = ${R}$; ± ${fmt(4 * se, 4)} (4 SE)` : `simulated with $R = ${R}$; the tail is exactly 0 here` },
        { key: 'chebyshev', label: 'Chebyshev bound $1/k^2$', observed: null, theory: cauchy ? 'does not apply' : r6(Math.min(1, 1 / (k * k))),
          convention: cauchy ? 'the Cauchy law has no variance' : exact > 0 ? `the bound is ${fmt(Math.min(1, 1 / (k * k)) / exact, 1)} times the real tail` : 'the real tail is 0: no value of $X$ lies this far from the mean' },
      ],
      series,
      axes: { x: '$k$ (in standard deviations)', y: 'probability' },
      notes: [
        'Chebyshev (L7): $P(|X - MX| \\ge \\varepsilon) \\le DX/\\varepsilon^2$. With $\\varepsilon = k\\sigma$ the bound is $1/k^2$ for every law with a variance.',
        'It is crude because it must hold for every such law: for the normal law at $k = 3$ the real tail is 0.0027 against the bound 0.111.',
        cauchy ? 'Cauchy has no variance (not even a mean), so the inequality says nothing; its tail falls only like $2/(\\pi k)$.' : `For the ${law.label} law the bound holds at every $k$, as it must.`,
      ],
    };
  }
  const { ns, paths } = runningMeans(law, N, seed);
  const lx = ns.map((n) => Math.log10(n)), lN = Math.log10(N); // x axis: log₁₀ n, so the early, wild part is readable
  const series = [];
  if (!cauchy) {
    const sd = law.sd;
    series.push({ id: 'band', kind: 'band', tone: 'signal', label: '$MX \\pm 3\\sigma/\\sqrt{n}$', x: lx, y: ns.map((n) => law.mean - 3 * sd / Math.sqrt(n)), y2: ns.map((n) => law.mean + 3 * sd / Math.sqrt(n)) });
    series.push({ id: 'mean', kind: 'line', tone: 'signal', label: '$MX$', x: [0, lN], y: [law.mean, law.mean] });
  } else {
    series.push({ id: 'median', kind: 'line', tone: 'muted', label: 'centre of symmetry 0 (not a mean)', x: [0, lN], y: [0, 0] });
  }
  paths.forEach((y, p) => series.push({ id: 'path' + p, kind: 'line', tone: p === 0 ? 'accent' : 'default', label: p === 0 ? `running means, ${CONV_PATHS} sequences` : undefined, x: lx, y }));
  const finals = paths.map((y) => y.at(-1));
  const spread = Math.max(...finals) - Math.min(...finals);
  return {
    readouts: [
      { key: 'final', label: `Running mean at $n = ${N}$, first sequence`, observed: r6(finals[0]), theory: cauchy ? 'does not exist' : r6(law.mean) },
      { key: 'spread', label: `Spread of the ${CONV_PATHS} running means at $n = ${N}$`, observed: r6(spread),
        theory: cauchy ? 'does not shrink' : `$\\approx ${fmt(law.sd / Math.sqrt(N), 4)}$ per sequence ($\\sigma/\\sqrt{n}$)` },
    ],
    series,
    axes: { x: '$\\lg n$ ($n = 10, 100, 1000$ at 1, 2, 3)', y: 'running mean $(X_1 + \\ldots + X_n)/n$' },
    notes: cauchy
      ? ['The Cauchy law has no expectation: $\\displaystyle\\int_{-\\infty}^{\\infty} \\frac{|x|\\,dx}{\\pi(1 + x^2)}$ diverges (L7, example after Khinchin\'s theorem).',
        'So no law of large numbers applies. The mean of $n$ Cauchy draws is again Cauchy with the same spread, so running means keep jumping however large $n$ gets. No band is drawn because none exists.']
      : ['Chebyshev\'s and Khinchin\'s theorems (L7): the running mean converges in probability to $MX$.',
        `The band $MX \\pm 3\\sigma/\\sqrt{n}$ narrows like $1/\\sqrt{n}$; almost every point of every sequence stays inside it.`],
  };
}

// ---------------------------------------------------------------- CLT station (L8–L9)
const Z_LO = -4, Z_HI = 4, Z_BINS = 40;
export const CLT_N_GRID = Object.freeze([1, 2, 3, 5, 8, 12, 20, 30, 50, 80, 100]);
/** R standardized sums (Sₙ − n·MX)/(σ√n). Term t of replicate r is draw (stream 500 + t, index r). */
export function standardizedSums(law, n, R, seed) {
  const out = new Float64Array(R), scale = law.sd * Math.sqrt(n);
  for (let r = 0; r < R; r++) {
    let s = 0;
    for (let t = 0; t < n; t++) s += law.draw(seed, 500 + 2 * t * 7919, r);
    out[r] = (s - n * law.mean) / scale;
  }
  return out;
}

function runClt({ law: li, n, R, view }, seed) {
  const law = LAWS[CLT_LAWS[li]];
  const band = ksBand(R);
  const notes = [
    'Lindeberg–Lévy (L8): for i.i.d. terms with finite variance, $\\dfrac{S_n - n\\,MX}{\\sigma\\sqrt{n}}$ tends in law to $N(0, 1)$, whatever the shape of one term.',
    law.discrete
      ? 'For a lattice law (Poisson) the standardized sum takes isolated values, so the Kolmogorov distance falls only like $1/\\sqrt{n}$: the CDF keeps jumps of that size.'
      : law.id === 'exponential' ? 'A skewed term (exponential) converges more slowly than a symmetric one (uniform): Berry–Esseen puts the error at order $1/\\sqrt{n}$.'
        : law.id === 'normal' ? 'A normal term gives an exactly normal sum for every $n$: the distance is pure Monte Carlo noise.' : 'A symmetric term converges fast: already $n = 3$ uniforms look normal.',
  ];
  if (view === 2) {
    const ns = Array.from({ length: 200 }, (_, i) => i + 1);
    return {
      readouts: [
        { key: 'poisson-lemma', label: `$\\sum_{k \\le n} \\frac{n^k}{k!} e^{-n}$ at $n = ${n}$`, observed: null, theory: r6(poissonLemmaSum(n)), convention: 'exact sum; limit $\\tfrac12$' },
        { key: 'poisson-lemma-1000', label: 'The same sum at $n = 1000$', observed: null, theory: r6(poissonLemmaSum(1000)) },
      ],
      series: [
        { id: 'half', kind: 'line', tone: 'signal', label: 'limit $\\tfrac12$', x: [1, 200], y: [0.5, 0.5] },
        { id: 'sum', kind: 'points', tone: 'default', label: '$\\sum_{k \\le n} \\frac{n^k}{k!} e^{-n}$', x: ns, y: ns.map(poissonLemmaSum) },
        { id: 'chosen', kind: 'rule', tone: 'muted', label: `$n = ${n}$`, x: [n], y: [0] },
      ],
      axes: { x: '$n$', y: '$P(\\mathrm{Poisson}(n) \\le n)$' },
      notes: [
        'The sum is $P(Y \\le n)$ for $Y \\sim \\mathrm{Poisson}(n)$. $Y$ is a sum of $n$ independent $\\mathrm{Poisson}(1)$ terms, so by the CLT $(Y - n)/\\sqrt{n} \\to N(0, 1)$ and $P(Y \\le n) \\to \\Phi(0) = \\tfrac12$.',
        'It approaches $\\tfrac12$ from above, slowly: the excess is about $\\dfrac{2}{3\\sqrt{2\\pi n}}$ (Ramanujan), about 0.027 at $n = 100$.',
      ],
    };
  }
  if (view === 1) {
    const ds = CLT_N_GRID.map((k) => kolmogorovDistance(standardizedSums(law, k, R, seed), normalCdf));
    return {
      readouts: [
        { key: 'ks-first', label: `Kolmogorov distance to $N(0, 1)$ at $n = ${CLT_N_GRID[0]}$`, observed: r6(ds[0]) },
        { key: 'ks-last', label: `Kolmogorov distance at $n = ${CLT_N_GRID.at(-1)}$`, observed: r6(ds.at(-1)), theory: `noise floor $\\approx ${fmt(band)}$`,
          convention: `99.9% band of $R = ${R}$ draws from $N(0, 1)$ itself` },
      ],
      series: [
        { id: 'floor', kind: 'band', tone: 'signal', label: 'Monte Carlo noise floor (99.9%)', x: [CLT_N_GRID[0], CLT_N_GRID.at(-1)], y: [0, 0], y2: [band, band] },
        { id: 'ks', kind: 'line', tone: 'default', label: `${law.label}: distance to $N(0, 1)$`, x: [...CLT_N_GRID], y: ds },
        { id: 'chosen', kind: 'rule', tone: 'muted', label: `$n = ${n}$`, x: [n], y: [0] },
      ],
      axes: { x: '$n$, terms in the sum', y: '$\\sup_z |F_n(z) - \\Phi(z)|$' },
      notes,
    };
  }
  const z = standardizedSums(law, n, R, seed);
  const w = (Z_HI - Z_LO) / Z_BINS, counts = new Array(Z_BINS).fill(0);
  let inside = 0;
  for (const v of z) {
    const k = Math.floor((v - Z_LO) / w);
    if (k >= 0 && k < Z_BINS) counts[k]++;
    if (Math.abs(v) <= 1) inside++;
  }
  const fine = grid(Z_LO, Z_HI, 161);
  const D = kolmogorovDistance(z, normalCdf);
  return {
    readouts: [
      { key: 'ks', label: `Kolmogorov distance to $N(0, 1)$, $n = ${n}$`, observed: r6(D), theory: `noise floor $\\approx ${fmt(band)}$`,
        convention: D <= band ? 'indistinguishable from normal at this R' : 'still visibly not normal' },
      { key: 'within1', label: 'Share with $|Z| \\le 1$', observed: r6(inside / R), theory: r6(1 - 2 * normalCdf(-1)) },
      { key: 'poisson-lemma', label: `$\\sum_{k \\le n} \\frac{n^k}{k!} e^{-n}$ at $n = ${n}$`, observed: null, theory: r6(poissonLemmaSum(n)), convention: 'exact; tends to $\\tfrac12$ (view 2)' },
    ],
    series: [
      { id: 'hist', kind: 'hist', tone: 'default', label: `standardized sums, $R = ${R}$`, x: Array.from({ length: Z_BINS }, (_, i) => Z_LO + i * w), y: counts.map((c) => c / (R * w)) },
      { id: 'pdf', kind: 'pdf', tone: 'signal', label: '$N(0, 1)$', x: fine, y: fine.map(normPdf) },
    ],
    axes: { x: '$z = (S_n - n\\,MX)/(\\sigma\\sqrt{n})$', y: 'density' },
    notes,
  };
}

// ---------------------------------------------------------------- contract
const stationParams = {
  convolution: [
    { key: 'm', label: 'Uniform terms $m$', min: 1, max: 6, step: 1, default: 3 },
    { key: 'R', label: 'Simulated sums $R$', min: 1000, max: 20000, step: 1000, default: 5000 },
  ],
  lln: [
    { key: 'law', label: 'Law (0 normal, 1 uniform, 2 exponential, 3 Poisson, 4 Cauchy)', min: 0, max: 4, step: 1, default: 4 },
    { key: 'N', label: 'Terms $N$', min: 100, max: 10000, step: 100, default: 2000 },
    { key: 'k', label: 'Deviation $k$ (view 1)', min: 0.5, max: 4, step: 0.1, default: 3 },
    { key: 'view', label: 'View (0 running means, 1 Chebyshev vs real tail)', min: 0, max: 1, step: 1, default: 0 },
  ],
  clt: [
    { key: 'law', label: 'Law of one term (0 uniform, 1 exponential, 2 Poisson, 3 normal)', min: 0, max: 3, step: 1, default: 1 },
    { key: 'n', label: 'Terms in the sum $n$', min: 1, max: 100, step: 1, default: 5 },
    { key: 'R', label: 'Replicates $R$', min: 1000, max: 10000, step: 1000, default: 4000 },
    { key: 'view', label: 'View (0 histogram, 1 distance vs $n$, 2 Poisson lemma)', min: 0, max: 2, step: 1, default: 0 },
  ],
};
export const stations = Object.freeze({
  convolution: { params: stationParams.convolution, live: true },
  lln: { params: stationParams.lln },
  clt: { params: stationParams.clt },
});
export const meta = {
  id: 'lecture-limit-theorems',
  lectures: ['L6', 'L7', 'L8', 'L9'],
  title: 'Convolution of uniforms, Chebyshev and the law of large numbers, Cauchy, and the central limit theorem',
  params: stationParams.clt,
};

export function run(params, { seed, station = 'clt' } = {}) {
  if (station === 'convolution') return runConvolution(params, seed);
  if (station === 'lln') return runConvergence(params, seed);
  return runClt(params, seed);
}
