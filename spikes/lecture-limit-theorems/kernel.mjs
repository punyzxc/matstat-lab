// Lecture kernel for L6–L9: sums of uniforms and their exact convolution (Convolution),
// the Chebyshev inequality, the law of large numbers and the Cauchy counterexample (Convergence),
// and the central limit theorem with the Poisson-lemma sum (CLT).
// Pure ES module: no DOM. Randomness only from fixtureUint32 (fixture-mix32-v1).
// Contract: docs/research/lecture-module-map.md; research: docs/research/lecture-limit-theorems.md.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import { normalCdf, kolmogorovQuantile } from '../lecture-special-functions/special.mjs';
import { CF_LAWS, empiricalPhi, tRange } from './charfn.mjs';
import { lawOf, checkLaw, lawPreview, DEFAULT_LAW, LAW_PRESETS, LAW_HINT } from '../custom-distributions/law.mjs';

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
  { id: 'poisson', label: 'Poisson, $\\lambda = 1$', mean: 1, sd: 1, discrete: true, lattice: { origin: 0, span: 1 },
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
/** #88: the index of the typed law in each station's law list. */
export const CUSTOM = Object.freeze({ lln: 5, clt: 4, ridge: 5 });
const adapted = new WeakMap();
/**
 * A typed law (#88) in the shape of LAWS: draws by its seeded inverse CDF, the exact tail P(|X − MX| ≥ kσ), and a
 * lattice (origin, span) when every value is an integer, so the ridge can show it by the local limit theorem.
 */
export function customLaw(text) {
  const t = lawOf(text ?? DEFAULT_LAW);
  let law = adapted.get(t);
  if (law) return law;
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  // Values on a common grid (whole numbers, or decimals to 6 places) make a lattice with span = gcd of the gaps.
  const S = 1e6, ints = t.kind === 'discrete' ? t.values.map((v) => Math.round(v * S)) : [];
  const onGrid = ints.length > 0 && t.values.every((v, j) => Math.abs(v * S - ints[j]) < 1e-6 * Math.max(1, Math.abs(v * S)));
  const lattice = onGrid ? { origin: t.values[0], span: ints.reduce((g, v) => gcd(g, v - ints[0]), 0) / S || 1 } : null;
  law = {
    id: 'custom', label: 'typed law', mean: t.mean, sd: t.sd, discrete: t.kind === 'discrete', lattice, typed: t,
    draw: (seed, s, i) => t.quantile(uni(seed, s, i)),
    tail: (k) => {
      const lo = t.mean - k * t.sd, hi = t.mean + k * t.sd;
      if (t.kind === 'continuous') return Math.max(0, 1 - (t.cdf(hi) - t.cdf(lo)));
      return t.values.reduce((acc, v, j) => (Math.abs(v - t.mean) >= k * t.sd - 1e-12 ? acc + t.probs[j] : acc), 0);
    },
  };
  adapted.set(t, law);
  return law;
}
const lawAt = (li, index, custom) => (li === index ? customLaw(custom) : null);

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

// #116: many paths and the Chebyshev corridor a ± ε.
/** Predeclared Monte Carlo band for a share of M paths: 4 standard errors, using SE ≤ 1/(2√M). */
export const corridorBand = (M) => 2 / Math.sqrt(M);
export const chebyshevBound = (sd, n, eps) => Math.min(1, (sd * sd) / (n * eps * eps));
const num4 = (v) => String(Number(v.toPrecision(4)));

function runCorridor({ law: li, N, M, eps, custom }, seed) {
  const law = lawAt(li, CUSTOM.lln, custom) ?? LAWS[li];
  const cauchy = law.mean == null, a = cauchy ? 0 : law.mean;
  const { ns, paths } = runningMeans(law, N, seed, M);
  const lx = ns.map((n) => Math.log10(n)), lN = Math.log10(N);
  const outside = ns.map((_, j) => paths.reduce((m, y) => m + (Math.abs(y[j] - a) >= eps ? 1 : 0), 0) / M);
  const share = outside.at(-1), bound = cauchy ? null : chebyshevBound(law.sd, N, eps);
  const span = cauchy ? 4 : Math.max(3 * eps, 2.5 * law.sd);
  const clipY = (v) => Math.max(a - span, Math.min(a + span, v));
  // The bundle as hairlines, then the corridor over it, then one path picked out.
  const series = [
    ...paths.map((y, p) => ({ id: 'path' + p, kind: 'line', tone: 'default', thin: true, label: p === 0 ? `running means $\\bar X_n$ of ${M} paths` : undefined, x: lx, y: y.map(clipY) })),
    { id: 'corridor', kind: 'band', tone: 'signal', label: `corridor $${cauchy ? '0' : 'a'} \\pm \\varepsilon$`, x: [0, lN], y: [a - eps, a - eps], y2: [a + eps, a + eps] },
    { id: 'a', kind: 'line', tone: 'signal', label: cauchy ? 'centre 0 (not a mean)' : `$a = MX = ${a}$`, x: [0, lN], y: [a, a] },
    { id: 'first', kind: 'line', tone: 'accent', label: 'one path', x: lx, y: paths[0].map(clipY) },
  ];
  const linked = {
    series: [
      ...(cauchy ? [] : [{ id: 'bound', kind: 'line', tone: 'signal', label: 'Chebyshev bound $\\sigma^2/(n\\varepsilon^2)$, capped at 1', x: lx, y: ns.map((n) => chebyshevBound(law.sd, n, eps)) }]),
      { id: 'outside', kind: 'line', tone: 'accent', label: 'share of paths outside the corridor', x: lx, y: outside },
    ],
    axes: { x: '$\\lg n$', y: 'share outside' },
    domain: { x: [0, lN], y: [0, 1] },
  };
  const m = Math.round(share * M);
  const notes = cauchy
    ? ['The Cauchy law has no mean and no variance: there is no $a$ to converge to and no Chebyshev bound. The share of paths outside the corridor does not fall, however large $n$ gets.']
    : ["Chebyshev's inequality (L7) for the mean of $n$ terms: $P(|\\bar X_n - a| \\ge \\varepsilon) \\le \\dfrac{D\\bar X_n}{\\varepsilon^2} = \\dfrac{\\sigma^2}{n\\varepsilon^2}$. As $n$ grows the bound falls to 0: that is the law of large numbers.",
      'The bound must hold for every law with this variance, so it is crude: the real share of paths outside is usually far below it.',
      `The share is counted over $M = ${M}$ paths; it may exceed the bound only by Monte Carlo error, at most $4 \\cdot \\tfrac{1}{2\\sqrt{M}} = ${fmt(corridorBand(M), 3)}$.`];
  const spread = Math.max(...paths.map((y) => y.at(-1))) - Math.min(...paths.map((y) => y.at(-1)));
  return {
    readouts: [
      { key: 'outside', label: `Share of paths outside $a \\pm \\varepsilon$ at $n = ${N}$`, observed: r6(share), theory: bound == null ? 'no bound' : r6(bound),
        convention: bound == null ? `${m} of ${M} paths` : `${m} of ${M} paths; theory: the Chebyshev bound` },
      { key: 'spread', label: `Spread of the ${M} running means at $n = ${N}$`, observed: r6(spread),
        theory: cauchy ? 'does not shrink' : r6(law.sd / Math.sqrt(N)), convention: cauchy ? undefined : 'theory: $\\sigma/\\sqrt{n}$ for one path' },
    ],
    series,
    linked,
    axes: { x: '$\\lg n$', y: 'running mean $\\bar X_n$' },
    domain: { x: [0, lN], y: [a - span, a + span] },
    formula: cauchy
      ? [`\\dfrac{m}{M} = \\dfrac{${m}}{${M}} = ${num4(share)}`]
      : [`P(|\\bar X_n - a| \\ge \\varepsilon) \\le \\dfrac{\\sigma^2}{n\\varepsilon^2} = \\dfrac{${num4(law.sd * law.sd)}}{${N} \\cdot ${eps}^2} = ${num4((law.sd * law.sd) / (N * eps * eps))}`,
        `\\dfrac{m}{M} = \\dfrac{${m}}{${M}} = ${num4(share)} ${share <= bound ? '\\le' : '>'} ${num4(bound)}`],
    notes,
  };
}

function runConvergence({ law: li, k, N, view, M, eps, custom }, seed) {
  if (view === 2) return runCorridor({ law: li, N, M: M ?? 200, eps: eps ?? 0.2, custom }, seed);
  const law = lawAt(li, CUSTOM.lln, custom) ?? LAWS[li];
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
        cauchy ? 'Cauchy has no variance (not even a mean), so the inequality says nothing; its tail falls only like $2/(\\pi k)$.' : law.id === 'custom' ? 'For the typed law the bound holds at every $k$, as it must.' : `For the ${law.label} law the bound holds at every $k$, as it must.`,
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
    // #128: the expectation and the running mean of the first sequence (none for Cauchy: it has no mean).
    ...(cauchy ? {} : { meet: {
      label: `$MX$ and the mean of $n = ${N}$ terms`,
      exact: { value: r6(law.mean), label: 'exact $MX$', series: 'mean' },
      sim: { value: r6(finals[0]), label: 'running mean, first sequence', series: 'path0' },
    } }),
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

// ---------------------------------------------------------------- CLT ridge (#86)
/** Sources of the ridge: the finite-variance laws, Bernoulli(p) and Cauchy (centre 0, scale 1: no mean, no variance). */
export const RIDGE_SOURCES = Object.freeze(['uniform', 'exponential', 'bernoulli', 'poisson', 'cauchy', 'custom']);
const RIDGE_BINS = 32;
/** A display ceiling for the ridge: a lattice law at small n puts its mass in a few spikes far above φ(0) ≈ 0.399. */
export const RIDGE_CEIL = 1.2;
export function ridgeLaw(source, p = 0.3, custom = DEFAULT_LAW) {
  if (source === 'custom') return customLaw(custom);
  if (source === 'bernoulli') {
    return { id: 'bernoulli', label: `Bernoulli, $p = ${p}$`, mean: p, sd: Math.sqrt(p * (1 - p)), discrete: true, lattice: { origin: 0, span: 1 },
      draw: (seed, s, i) => (uni(seed, s, i) < p ? 1 : 0) };
  }
  return LAWS.find((l) => l.id === source);
}
/**
 * Standardized sums S*_n = (Sₙ − n·MX)/(σ√n) for n = 1..nMax along the same R paths: term t of path r is draw
 * (stream 900 + 2·t·7919, index r), so slice n + 1 adds one term to slice n. For Cauchy the centre is 0 and the scale 1
 * (S_n/√n, the CLT's own scaling), which spreads out instead of settling. Returns rows[n − 1] = Float64Array(R).
 */
export function ridgeSums(law, nMax, R, seed) {
  const centre = law.mean ?? 0, sd = law.sd ?? 1;
  const rows = Array.from({ length: nMax }, () => new Float64Array(R));
  for (let r = 0; r < R; r++) {
    let s = 0;
    for (let t = 0; t < nMax; t++) {
      s += law.draw(seed, 900 + 2 * t * 7919, r);
      rows[t][r] = (s - (t + 1) * centre) / (sd * Math.sqrt(t + 1));
    }
  }
  return rows;
}

/**
 * A lattice slice (#86): S_n takes integer values k, i.e. S*_n takes x_k = (k − n·MX)/(σ√n), a step h = 1/(σ√n) apart.
 * The height at x_k is the sample share of k over h (the local limit theorem's scaling, so it tends to φ), joined
 * linearly between neighbouring values and read at the grid points xs.
 */
export function latticeSlice(row, n, law, R, xs) {
  // S_n = n·origin + span·k: the standardized values sit h = span/(σ√n) apart.
  const { origin, span } = law.lattice ?? { origin: 0, span: 1 };
  const scale = law.sd * Math.sqrt(n), h = span / scale, shift = n * (law.mean - origin);
  const counts = new Map();
  for (const v of row) {
    const k = Math.round((v * scale + shift) / span);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const H = (k) => (counts.get(k) ?? 0) / R / h;
  return xs.map((x) => {
    const u = (x * scale + shift) / span, k0 = Math.floor(u), f = u - k0;
    return r6(H(k0) * (1 - f) + H(k0 + 1) * f);
  });
}

function runRidge({ source: si, p, nmax, R, custom }, seed) {
  const id = RIDGE_SOURCES[si] ?? 'uniform';
  const law = ridgeLaw(id, p, custom);
  const cauchy = id === 'cauchy';
  const rows = ridgeSums(law, nmax, R, seed);
  const w = (Z_HI - Z_LO) / RIDGE_BINS;
  const xs = Array.from({ length: RIDGE_BINS }, (_, i) => r6(Z_LO + (i + 0.5) * w));
  const ns = Array.from({ length: nmax }, (_, i) => i + 1);
  const z = rows.map((row, j) => {
    if (law.discrete && (law.lattice || law.id === 'poisson')) return latticeSlice(row, j + 1, law, R, xs);
    const counts = new Array(RIDGE_BINS).fill(0);
    for (const v of row) {
      const k = Math.floor((v - Z_LO) / w);
      if (k >= 0 && k < RIDGE_BINS) counts[k]++;
    }
    return counts.map((c) => r6(c / (R * w)));
  });
  const ds = rows.map((row) => r6(kolmogorovDistance(row, normalCdf)));
  const band = ksBand(R);
  const settled = ds.findIndex((d) => d <= band);
  const head = cauchy ? 'Cauchy terms: $S_n/\\sqrt{n}$ flattens instead of settling' : id === 'custom' ? 'Typed law: $S_n^* = \\dfrac{S_n - n\\,MX}{\\sigma\\sqrt{n}}$' : `${law.label}: $S_n^* = \\dfrac{S_n - n\\,MX}{\\sigma\\sqrt{n}}$`;
  const tall = law.discrete && z.some((row) => row.some((v) => v > RIDGE_CEIL));
  const notes = cauchy
    ? ['The Cauchy law has no mean and no variance, so the CLT does not apply: $S_n/n$ is again Cauchy, and $S_n/\\sqrt{n}$ is Cauchy with scale $\\sqrt{n}$. The ridge flattens and leaks out of the window instead of settling onto $\\varphi$, and the distance to $\\Phi$ grows towards $\\tfrac12$.']
    : ['Lindeberg–Lévy (L8): for i.i.d. terms with finite variance the law of $S_n^*$ tends to $N(0, 1)$. Each slice of the ridge is the histogram of $S_n^*$ over the same $R$ paths, one more term per slice; the far wall carries the exact $\\varphi(x) = \\dfrac{1}{\\sqrt{2\\pi}}\\,e^{-x^2/2}$.',
      law.discrete && (law.lattice || law.id === 'poisson')
        ? 'A lattice law (Bernoulli, Poisson) gives $S_n^*$ isolated values $1/(\\sigma\\sqrt{n})$ apart: each slice shows the share of every value divided by that step, which tends to $\\varphi$ (the local limit theorem). The CDF still jumps, so the Kolmogorov distance falls only like $1/\\sqrt{n}$ (Berry–Esseen).'
        : id === 'exponential' ? 'A skewed term (exponential) leans to the left for small $n$ and straightens slowly: the Berry–Esseen error is of order $1/\\sqrt{n}$.'
          : 'A symmetric term (uniform) settles fast: by $n = 3$ the slice is hard to tell from $\\varphi$.'];
  if (tall) notes.push(`Spikes taller than ${RIDGE_CEIL} are cut at that height; the point readout gives their true value.`);
  return {
    readouts: [
      { key: 'ks-first', label: 'Kolmogorov distance to $\\Phi$ at $n = 1$', observed: ds[0] },
      { key: 'ks-last', label: `Kolmogorov distance to $\\Phi$ at $n = ${nmax}$`, observed: ds.at(-1), theory: cauchy ? 'does not tend to 0' : `noise floor $\\approx ${fmt(band)}$`,
        convention: `99.9% band of $R = ${R}$ draws from $N(0, 1)$ itself` },
      { key: 'settled', label: 'First $n$ inside the noise floor', observed: settled < 0 ? null : settled + 1,
        theory: cauchy ? 'never: the CLT does not apply' : settled < 0 ? `not yet by $n = ${nmax}$` : null },
    ],
    series: [
      { id: 'floor', kind: 'band', tone: 'signal', label: 'Monte Carlo noise floor (99.9%)', x: [1, nmax], y: [0, 0], y2: [band, band] },
      { id: 'ks', kind: 'line', tone: 'default', label: '$D_n = \\sup_x |F_n(x) - \\Phi(x)|$', x: ns, y: ds },
      { id: 'ks-dots', kind: 'points', tone: 'default', x: ns, y: ds },
    ],
    axes: { x: '$n$, terms in the sum', y: '$D_n$' },
    surface: {
      x: xs, y: ns, z,
      labels: { x: '$x$', y: '$n$', z: 'density' },
      title: head,
      keyLabel: law.discrete && (law.lattice || law.id === 'poisson') ? 'share of each value of $S_n^*$ over the lattice step, one slice per $n$' : 'histogram of the standardized sums, one slice per $n$',
      zCeil: RIDGE_CEIL,
      wall: { x: grid(Z_LO, Z_HI, 81).map(r6), z: grid(Z_LO, Z_HI, 81).map((x) => r6(normPdf(x))), label: 'exact $\\varphi(x)$ on the far wall' },
      rowNotes: ds.map((d, j) => `$D_{${j + 1}} = ${d}$`),
    },
    notes,
  };
}

function runClt({ law: li, n, R, view, source, p, nmax, custom }, seed) {
  if (view === 3) return runRidge({ source: source ?? 0, p: p ?? 0.3, nmax: nmax ?? 30, R, custom }, seed);
  const law = lawAt(li, CUSTOM.clt, custom) ?? LAWS[CLT_LAWS[li]];
  const band = ksBand(R);
  const notes = [
    'Lindeberg–Lévy (L8): for i.i.d. terms with finite variance, $\\dfrac{S_n - n\\,MX}{\\sigma\\sqrt{n}}$ tends in law to $N(0, 1)$, whatever the shape of one term.',
    law.discrete
      ? 'For a lattice law (Poisson) the standardized sum takes isolated values, so the Kolmogorov distance falls only like $1/\\sqrt{n}$: the CDF keeps jumps of that size.'
      : law.id === 'exponential' ? 'A skewed term (exponential) converges more slowly than a symmetric one (uniform): Berry–Esseen puts the error at order $1/\\sqrt{n}$.'
        : law.id === 'normal' ? 'A normal term gives an exactly normal sum for every $n$: the distance is pure Monte Carlo noise.'
          : law.id === 'custom' ? 'Your typed law has a finite variance, so the CLT applies to it as to any other: a skewed or lumpy law only takes longer.'
            : 'A symmetric term converges fast: already $n = 3$ uniforms look normal.',
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
    // #128: the exact law of the sum where it has a closed form, the CLT limit, and the share of the R sums.
    meet: {
      label: `$P(|Z| \\le 1)$, $n = ${n}$`,
      ...(within1Exact(law, n) == null ? {} : { exact: { value: r6(within1Exact(law, n)), label: EXACT_SUM[law.id] } }),
      approx: { value: r6(1 - 2 * normalCdf(-1)), label: 'CLT limit $2\\Phi(1) - 1$', series: 'pdf' },
      sim: { value: r6(inside / R), label: `share of $R = ${R}$ sums`, series: 'hist' },
    },
  };
}

const EXACT_SUM = { normal: 'exact: the sum is normal', uniform: 'exact: Irwin–Hall law', exponential: 'exact: Erlang law', poisson: 'exact: Poisson law of the sum' };
/**
 * P(|Z| ≤ 1) for Z = (Sₙ − n·MX)/(σ√n), exactly from the law of the sum: normal, Irwin–Hall (n ≤ 30, where the
 * alternating sum is still exact in doubles), Erlang (gamma with integer shape) and Poisson(n).
 */
export function within1Exact(law, n) {
  const lo = n * law.mean - law.sd * Math.sqrt(n), hi = n * law.mean + law.sd * Math.sqrt(n);
  if (law.id === 'normal') return 1 - 2 * normalCdf(-1);
  if (law.id === 'uniform') return n <= 30 ? irwinHallCdf(hi, n) - irwinHallCdf(lo, n) : null;
  if (law.id === 'exponential') return erlangCdf(hi, n) - erlangCdf(lo, n);
  if (law.id === 'poisson') {
    let s = 0;
    for (let k = Math.max(0, Math.ceil(lo - 1e-12)); k <= Math.floor(hi + 1e-12); k++) s += Math.exp(k * Math.log(n) - n - logFactorial(k));
    return s;
  }
  return null;
}
const logFactorial = (k) => { let s = 0; for (let j = 2; j <= k; j++) s += Math.log(j); return s; };
/** P(S ≤ x) for S a sum of n Exp(1): 1 − e^{−x} Σ_{k<n} x^k/k!, summed in log space. */
export function erlangCdf(x, n) {
  if (x <= 0) return 0;
  let s = 0;
  for (let k = 0; k < n; k++) s += Math.exp(k * Math.log(x) - x - logFactorial(k));
  return Math.min(1, Math.max(0, 1 - s));
}

// ---------------------------------------------------------------- characteristic function (L9, #121)
export const PHASOR_SHOWN = 240; // vectors drawn; the mean uses all n
const CF_GRID = 241;
const d4 = (v) => String(Number((Math.abs(v) < 5e-13 ? 0 : v).toPrecision(4)));
const cTex = ([re, im]) => `${d4(re)} ${im < 0 ? '-' : '+'} ${d4(Math.abs(im))}\\,i`;

function runCharfn(q0, seed) {
  if (q0.view === 1) return runCharfnSum(q0, seed);
  const { law: li, t, motion, n, p, m, lambda, a, s } = q0;
  const law = CF_LAWS[li];
  const q = { p, m, lambda, a, s };
  const u = (k, i) => uni(seed, 1300 + 7 * k, i);
  const xs = Array.from({ length: n }, (_, i) => law.draw(u, i, q));
  const T = tRange(law, q);
  const ts = grid(-T, T, CF_GRID);
  const exact = ts.map((v) => law.phi(v, q)), emp = ts.map((v) => empiricalPhi(xs, v));
  const ph = law.phi(t, q), eh = empiricalPhi(xs, t);
  const band = 4 / Math.sqrt(n);
  const symmetric = law.symmetric(q);
  const near = (x, y) => Math.abs(x - y) <= band;
  const readouts = [
    { key: 're', label: `$\\operatorname{Re}\\varphi(t)$ at $t = ${t}$`, observed: r6(eh[0]), theory: r6(ph[0]), convention: `± ${fmt(band, 3)} (4 SE); ${near(eh[0], ph[0]) ? 'inside' : 'outside'}` },
    { key: 'im', label: `$\\operatorname{Im}\\varphi(t)$ at $t = ${t}$`, observed: r6(eh[1]), theory: r6(ph[1] + 0), convention: symmetric ? 'symmetric law: $\\operatorname{Im}\\varphi \\equiv 0$' : `± ${fmt(band, 3)} (4 SE)` },
    { key: 'abs', label: '$|\\varphi(t)|$, never above 1', observed: r6(Math.hypot(...eh)), theory: r6(Math.hypot(...ph)) },
    { key: 'zero', label: '$\\varphi(0) = M\\,e^{0} = 1$', observed: r6(empiricalPhi(xs, 0)[0]), theory: 1 },
  ];
  const notes = [
    'L9: the characteristic function is $\\varphi(t) = M e^{itX}$. Each value $x_j$ becomes the unit vector $e^{itx_j} = \\cos tx_j + i \\sin tx_j$; their mean is the empirical $\\hat\\varphi(t)$, which settles at $\\varphi(t)$ as $n$ grows.',
    'Every vector has length 1, so their mean never leaves the unit disc: $|\\varphi(t)| \\le 1$, and $\\varphi(0) = 1$ because at $t = 0$ all vectors point to 1.',
  ];
  if (symmetric) notes.push('The law is symmetric about 0, so the vectors of $x$ and $-x$ are mirror images: the imaginary parts cancel and $\\operatorname{Im}\\varphi \\equiv 0$. The empirical one only wobbles about 0.');
  if (law.id === 'bernoulli' || law.id === 'binomial' || law.id === 'poisson') notes.push('Integer values make $\\varphi$ periodic with period $2\\pi$: $e^{i(t + 2\\pi)k} = e^{itk}$.');
  return {
    readouts,
    series: [
      { id: 'reExact', kind: 'line', tone: 'signal', label: '$\\operatorname{Re}\\varphi(t)$', x: ts, y: exact.map((z) => z[0]) },
      { id: 'imExact', kind: 'line', tone: 'accent', label: '$\\operatorname{Im}\\varphi(t)$', x: ts, y: exact.map((z) => z[1]) },
      { id: 'reEmp', kind: 'line', tone: 'default', thin: true, label: `empirical, $n = ${n}$`, x: ts, y: emp.map((z) => z[0]) },
      { id: 'imEmp', kind: 'line', tone: 'default', thin: true, x: ts, y: emp.map((z) => z[1]) },
      { id: 't', kind: 'rule', tone: 'muted', label: `$t = ${t}$`, x: [t], y: [0] },
    ],
    axes: { x: '$t$', y: '$\\operatorname{Re}\\varphi$, $\\operatorname{Im}\\varphi$' },
    domain: { x: [-T, T], y: [-1.05, 1.05] },
    formula: [
      `\\varphi(t) = M\\,e^{itX} = ${law.tex(q)}`,
      `\\varphi(${t}) = ${cTex(ph)}, \\quad \\hat\\varphi(${t}) = \\dfrac{1}{n}\\sum_{j=1}^{n} e^{i t x_j} = ${cTex(eh)}`,
    ],
    phasor: { xs: xs.map((x) => r6(x)), shown: Math.min(n, PHASOR_SHOWN), T, t, motion: motion === 0, ts: ts.map(r6),
      exact: exact.map((z) => [r6(z[0]), r6(z[1] + 0)]), symmetric },
    notes,
  };
}

// #122: the sum of independent X and Y has the product of their characteristic functions.
const SUM_BINS = 60;
const isInteger = (law) => law.id === 'bernoulli' || law.id === 'binomial' || law.id === 'poisson';

function runCharfnSum({ law: lx, law2: ly, t, motion, n, p, m, lambda, a, s, p2, m2, lambda2, a2, s2 }, seed) {
  const X = CF_LAWS[lx], Y = CF_LAWS[ly];
  const qx = { p, m, lambda, a, s }, qy = { p: p2, m: m2, lambda: lambda2, a: a2, s: s2 };
  const ux = (k, i) => uni(seed, 1300 + 7 * k, i), uy = (k, i) => uni(seed, 1500 + 7 * k, i);
  const xs = Array.from({ length: n }, (_, i) => X.draw(ux, i, qx));
  const ys = Array.from({ length: n }, (_, i) => Y.draw(uy, i, qy));
  const sums = xs.map((x, i) => x + ys[i]);
  const T = Math.min(tRange(X, qx), tRange(Y, qy));
  const ts = grid(-T, T, CF_GRID);
  const fx = ts.map((v) => X.phi(v, qx)), fy = ts.map((v) => Y.phi(v, qy));
  const prod = fx.map((z, i) => [z[0] * fy[i][0] - z[1] * fy[i][1], z[0] * fy[i][1] + z[1] * fy[i][0]]);
  const emp = ts.map((v) => empiricalPhi(sums, v));
  const px = X.phi(t, qx), py = Y.phi(t, qy);
  const ph = [px[0] * py[0] - px[1] * py[1], px[0] * py[1] + px[1] * py[0]];
  const eh = empiricalPhi(sums, t);
  const band = 4 / Math.sqrt(n);
  const near = (u, v) => Math.abs(u - v) <= band;
  const mu = X.mean(qx) + Y.mean(qy), v2 = X.variance(qx) + Y.variance(qy);
  const mean = sums.reduce((u, v) => u + v, 0) / n;
  const varS = sums.reduce((u, v) => u + (v - mean) ** 2, 0) / Math.max(1, n - 1);
  const readouts = [
    { key: 're', label: `$\\operatorname{Re}\\varphi_{X+Y}(t)$ at $t = ${t}$`, observed: r6(eh[0]), theory: r6(ph[0]),
      convention: `product $\\varphi_X\\varphi_Y$; ± ${fmt(band, 3)} (4 SE); ${near(eh[0], ph[0]) ? 'inside' : 'outside'}` },
    { key: 'im', label: `$\\operatorname{Im}\\varphi_{X+Y}(t)$ at $t = ${t}$`, observed: r6(eh[1]), theory: r6(ph[1] + 0),
      convention: `product $\\varphi_X\\varphi_Y$; ± ${fmt(band, 3)} (4 SE); ${near(eh[1], ph[1]) ? 'inside' : 'outside'}` },
    { key: 'mean', label: '$M(X+Y) = MX + MY$', observed: r6(mean), theory: r6(mu) },
    { key: 'var', label: '$D(X+Y) = DX + DY$ for independent terms', observed: r6(varS), theory: r6(v2) },
  ];
  // The histogram of the sums: integer laws on both sides give integer sums, drawn as frequencies.
  let hist;
  if (isInteger(X) && isInteger(Y)) {
    const top = Math.max(...sums), counts = new Array(top + 1).fill(0);
    for (const v of sums) counts[v]++;
    hist = { id: 'hist', kind: 'pmf', tone: 'default', label: `frequencies of $X + Y$, $n = ${n}$`, x: counts.map((_, k) => k), y: counts.map((c) => c / n) };
  } else {
    const sd = Math.sqrt(v2), lo = mu - 4.5 * sd, hi = mu + 4.5 * sd, w = (hi - lo) / SUM_BINS;
    const counts = new Array(SUM_BINS).fill(0);
    for (const v of sums) { const k = Math.floor((v - lo) / w); if (k >= 0 && k < SUM_BINS) counts[k]++; }
    hist = { id: 'hist', kind: 'hist', tone: 'default', label: `histogram of $X + Y$, $n = ${n}$`, x: counts.map((_, k) => lo + k * w), y: counts.map((c) => c / (n * w)) };
  }
  const notes = [
    'L9: for independent $X$ and $Y$, $\\varphi_{X+Y}(t) = M e^{it(X+Y)} = M e^{itX} \\cdot M e^{itY} = \\varphi_X(t)\\,\\varphi_Y(t)$. Adding variables convolves their laws, but multiplies their characteristic functions.',
    'On the plane, multiplying complex numbers multiplies their lengths and adds their angles: the arrow of the product turns by the angles of $\\varphi_X(t)$ and $\\varphi_Y(t)$ together. The mean of the vectors $e^{it(x_j + y_j)}$ of the simulated sums lands on it.',
  ];
  return {
    readouts,
    series: [hist],
    axes: { x: '$x$', y: 'share' },
    linked: {
      series: [
        { id: 'reX', kind: 'line', tone: 'muted', label: '$\\operatorname{Re}\\varphi_X(t)$', x: ts, y: fx.map((z) => z[0]) },
        { id: 'reY', kind: 'line', tone: 'default', label: '$\\operatorname{Re}\\varphi_Y(t)$', x: ts, y: fy.map((z) => z[0]) },
        { id: 'reProd', kind: 'line', tone: 'signal', label: '$\\operatorname{Re}\\,\\varphi_X\\varphi_Y$', x: ts, y: prod.map((z) => z[0]) },
        { id: 'reEmp', kind: 'line', tone: 'default', thin: true, label: `$\\operatorname{Re}\\hat\\varphi_{X+Y}$ of the sums, $n = ${n}$`, x: ts, y: emp.map((z) => z[0]) },
        { id: 't', kind: 'rule', tone: 'muted', label: `$t = ${t}$`, x: [t], y: [0] },
      ],
      axes: { x: '$t$', y: '$\\operatorname{Re}\\varphi$' },
      domain: { x: [-T, T], y: [-1.05, 1.05] },
    },
    formula: [
      `\\varphi_{X+Y}(t) = M\\,e^{it(X+Y)} = M\\,e^{itX}\\, M\\,e^{itY} = \\varphi_X(t)\\,\\varphi_Y(t)`,
      `\\varphi_X(${t})\\,\\varphi_Y(${t}) = \\left(${cTex(px)}\\right)\\left(${cTex(py)}\\right) = ${cTex(ph)}`,
      `\\hat\\varphi_{X+Y}(${t}) = \\dfrac{1}{n}\\sum_{j=1}^{n} e^{i t (x_j + y_j)} = ${cTex(eh)}`,
    ],
    phasor: { xs: sums.map((v) => r6(v)), shown: Math.min(n, PHASOR_SHOWN), T, t, motion: motion === 0, ts: ts.map(r6),
      exact: prod.map((z) => [r6(z[0]), r6(z[1] + 0)]), symmetric: false,
      parts: [
        { key: 'X', exact: fx.map((z) => [r6(z[0]), r6(z[1] + 0)]) },
        { key: 'Y', exact: fy.map((z) => [r6(z[0]), r6(z[1] + 0)]) },
      ] },
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
    { key: 'law', label: 'Law (0 normal, 1 uniform, 2 exponential, 3 Poisson, 4 Cauchy, 5 typed)', min: 0, max: 5, step: 1, default: 4 },
    { key: 'N', label: 'Terms $N$', min: 100, max: 10000, step: 100, default: 2000 },
    { key: 'k', label: 'Deviation $k$ (view 1)', min: 0.5, max: 4, step: 0.1, default: 3, when: { view: [1] } },
    { key: 'view', label: 'View (0 running means, 1 Chebyshev vs real tail, 2 corridor of many paths)', min: 0, max: 2, step: 1, default: 0 },
    { key: 'M', label: 'Paths $M$', min: 1, max: 500, step: 1, default: 200, when: { view: [2] } },
    { key: 'eps', label: 'Corridor half-width $\\varepsilon$', min: 0.01, max: 2, step: 0.01, default: 0.2, when: { view: [2] } },
  ],
  clt: [
    { key: 'law', label: 'Law of one term (0 uniform, 1 exponential, 2 Poisson, 3 normal, 4 typed)', min: 0, max: 4, step: 1, default: 1, when: { view: [0, 1, 2] } },
    { key: 'n', label: 'Terms in the sum $n$', min: 1, max: 100, step: 1, default: 5, when: { view: [0, 1, 2] } },
    { key: 'R', label: 'Replicates $R$', min: 1000, max: 10000, step: 1000, default: 4000 },
    { key: 'view', label: 'View (0 histogram, 1 distance vs $n$, 2 Poisson lemma, 3 ridge over $n$)', min: 0, max: 3, step: 1, default: 0 },
    { key: 'source', label: 'Law of one term (0 uniform, 1 exponential, 2 Bernoulli, 3 Poisson, 4 Cauchy, 5 typed)', min: 0, max: 5, step: 1, default: 1, when: { view: [3] } },
    { key: 'p', label: 'Bernoulli probability $p$', min: 0.01, max: 0.99, step: 0.01, default: 0.3, when: { view: [3], source: [2] } },
    { key: 'nmax', label: 'Largest $n$ on the ridge', min: 2, max: 40, step: 1, default: 30, when: { view: [3] } },
  ],
};
stationParams.charfn = [
  { key: 'view', label: 'View (0 one law, 1 sum $X + Y$)', min: 0, max: 1, step: 1, default: 0 },
  { key: 'law', label: 'Law (0 Bernoulli, 1 binomial, 2 Poisson, 3 uniform, 4 normal, 5 exponential)', min: 0, max: 5, step: 1, default: 4 },
  { key: 'motion', label: 'Parameter $t$ (0 sweeps by itself, 1 stays at the typed value)', min: 0, max: 1, step: 1, default: 0 },
  { key: 't', label: 'Value of $t$', min: -20, max: 20, step: 0.01, default: 1 },
  { key: 'n', label: 'Sample size $n$', min: 10, max: 5000, step: 10, default: 500 },
  { key: 'p', label: 'Probability $p$', min: 0.01, max: 0.99, step: 0.01, default: 0.3, when: { law: [0, 1] } },
  { key: 'm', label: 'Trials $m$', min: 1, max: 30, step: 1, default: 10, when: { law: [1] } },
  { key: 'lambda', label: 'Rate $\\lambda$', min: 0.1, max: 10, step: 0.1, default: 2, when: { law: [2, 5] } },
  { key: 'a', label: 'Centre $a$', min: -3, max: 3, step: 0.1, default: 0, when: { law: [3, 4] } },
  { key: 's', label: 'Spread $s$ (half-width or $\\sigma$)', min: 0.1, max: 3, step: 0.1, default: 1, when: { law: [3, 4] } },
  { key: 'law2', label: 'Law of $Y$ (0 Bernoulli, 1 binomial, 2 Poisson, 3 uniform, 4 normal, 5 exponential)', min: 0, max: 5, step: 1, default: 3, when: { view: [1] } },
  { key: 'p2', label: 'Probability $p$ of $Y$', min: 0.01, max: 0.99, step: 0.01, default: 0.5, when: { view: [1], law2: [0, 1] } },
  { key: 'm2', label: 'Trials $m$ of $Y$', min: 1, max: 30, step: 1, default: 6, when: { view: [1], law2: [1] } },
  { key: 'lambda2', label: 'Rate $\\lambda$ of $Y$', min: 0.1, max: 10, step: 0.1, default: 1, when: { view: [1], law2: [2, 5] } },
  { key: 'a2', label: 'Centre $a$ of $Y$', min: -3, max: 3, step: 0.1, default: 0, when: { view: [1], law2: [3, 4] } },
  { key: 's2', label: 'Spread $s$ of $Y$', min: 0.1, max: 3, step: 0.1, default: 1, when: { view: [1], law2: [3, 4] } },
];
const customText = (when) => ({ key: 'custom', label: 'Your law: values | probabilities, or a density on $[a, b]$', default: DEFAULT_LAW, presets: [...LAW_PRESETS], hint: LAW_HINT, when });
export const stations = Object.freeze({
  convolution: { params: stationParams.convolution, live: true },
  lln: { params: stationParams.lln, texts: [customText({ law: [CUSTOM.lln] })] },
  clt: { params: stationParams.clt, texts: [customText([{ view: [0, 1], law: [CUSTOM.clt] }, { view: [3], source: [CUSTOM.ridge] }])] },
  charfn: { params: stationParams.charfn, live: true },
});
export const meta = {
  id: 'lecture-limit-theorems',
  lectures: ['L6', 'L7', 'L8', 'L9'],
  title: 'Convolution of uniforms, Chebyshev and the law of large numbers, Cauchy, and the central limit theorem',
  params: stationParams.clt,
};

/** #88: checks the typed law before the host runs it. */
export function checkText(station, key, value) {
  if (key !== 'custom' || (station !== 'lln' && station !== 'clt')) return null;
  return checkLaw(value);
}
/** Whether this run draws from the typed law. */
const usesCustom = (station, q) => (station === 'lln' ? q.law === CUSTOM.lln : station === 'clt' && (q.view === 3 ? q.source === CUSTOM.ridge : q.view !== 2 && q.law === CUSTOM.clt));
/** #88: the typed law's formula on top, and its pmf or pdf with the CDF as a linked chart where the view has none. */
function withPreview(out, text) {
  const t = lawOf(text ?? DEFAULT_LAW), pv = lawPreview(t);
  return {
    ...out,
    formula: [t.tex, ...(out.formula ?? [])],
    ...(out.linked ? {} : { linked: { series: pv.series, axes: { x: '$x$', y: t.kind === 'discrete' ? '$p_i$, $F(x)$' : '$f(x)$, $F(x)$' }, ...(pv.domain ? { domain: pv.domain } : {}) } }),
  };
}

export function run(params, { seed, station = 'clt' } = {}) {
  const out = runStation(params, { seed, station });
  return usesCustom(station, params ?? {}) ? withPreview(out, params.custom) : out;
}
function runStation(params, { seed, station }) {
  if (station === 'convolution') return runConvolution(params, seed);
  if (station === 'lln') return runConvergence(params, seed);
  if (station === 'charfn') {
    const q = Object.fromEntries(stationParams.charfn.map((d) => [d.key, Number.isFinite(params?.[d.key]) ? params[d.key] : d.default]));
    if (!Number.isInteger(q.n) || q.n < 1) throw new Error('n must be a positive integer.');
    return runCharfn(q, seed);
  }
  return runClt(params, seed);
}
