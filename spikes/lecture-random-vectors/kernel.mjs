// Lecture kernel for L5–L6: moments and the 3σ rule (Moments), functions of a random
// variable (Transform), random vectors, correlation and regression lines (Scatter).
// Pure ES module: no DOM. Randomness only from fixtureUint32 (fixture-mix32-v1).
// Contract: docs/research/lecture-module-map.md; research: docs/research/lecture-random-vectors.md.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';

/** Uniform on (0, 1), never 0 or 1, from one counter-based draw. */
const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;
/** Box–Muller with fixed indices: draw i always uses (stream, i) and (stream + 1, i). */
const gauss = (seed, stream, i) =>
  Math.sqrt(-2 * Math.log(uni(seed, stream, i))) * Math.cos(2 * Math.PI * uni(seed, stream + 1, i));

const SQRT2PI = Math.sqrt(2 * Math.PI);
/** erf by the all-positive series erf(x) = 2/√π · e^(−x²) · Σ (2x²)ⁿ x / (1·3·…·(2n+1)). */
export function erf(x) {
  if (x < 0) return -erf(-x);
  if (x > 6) return 1;
  let term = x, sum = x;
  for (let n = 1; n < 500; n++) {
    term *= (2 * x * x) / (2 * n + 1);
    sum += term;
    if (term < 1e-17 * sum) break;
  }
  return (2 / Math.sqrt(Math.PI)) * Math.exp(-x * x) * sum;
}
/** Φ(x) = P(N(0,1) ≤ x), the CDF (L6 integrates from −∞). Not Φ₀ (L12) and not erf (L9). */
export const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
const normPdf = (z) => Math.exp(-0.5 * z * z) / SQRT2PI;

const r6 = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(6)));
const grid = (lo, hi, count) => Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));
const LAW_NAMES = ['Bernoulli', 'Binomial', 'Poisson', 'Uniform', 'Exponential', 'Normal'];

/**
 * The six lecture laws (L5 §Main distributions; moments from L6).
 * Discrete laws carry their full support and PMF; continuous ones a pdf, cdf and display range.
 */
export function makeLaw(index, { p, m, lambda, sigma }) {
  const q = 1 - p;
  if (index === 0 || index === 1) {
    const trials = index === 0 ? 1 : m;
    const support = Array.from({ length: trials + 1 }, (_, k) => k);
    const pmf = [q ** trials];
    for (let k = 0; k < trials; k++) pmf.push((pmf[k] * (trials - k) * p) / ((k + 1) * q));
    const npq = trials * p * q;
    const top = (trials + 1) * p; // mode: ⌊(m+1)p⌋, two modes when (m+1)p is an integer
    const isInt = Math.abs(top - Math.round(top)) < 1e-9;
    const mode = isInt && Math.round(top) >= 1 && Math.round(top) <= trials ? [Math.round(top) - 1, Math.round(top)] : [Math.min(trials, Math.floor(top))];
    return {
      name: index === 0 ? `Bernoulli(p = ${p})` : `Binomial(m = ${trials}, p = ${p})`, discrete: true, support, pmf,
      mean: trials * p, variance: npq, skew: (q - p) / Math.sqrt(npq), exkurt: (1 - 6 * p * q) / npq, mode,
      sample: (seed, i) => {
        let s = 0;
        for (let t = 0; t < trials; t++) if (uni(seed, 20 + t, i) < p) s++;
        return s;
      },
    };
  }
  if (index === 2) {
    const top = Math.ceil(lambda + 12 * Math.sqrt(lambda) + 12);
    const support = Array.from({ length: top + 1 }, (_, k) => k);
    const pmf = [Math.exp(-lambda)];
    for (let k = 0; k < top; k++) pmf.push((pmf[k] * lambda) / (k + 1));
    const isInt = Math.abs(lambda - Math.round(lambda)) < 1e-9;
    return {
      name: `Poisson(λ = ${lambda})`, discrete: true, support, pmf,
      mean: lambda, variance: lambda, skew: 1 / Math.sqrt(lambda), exkurt: 1 / lambda,
      mode: isInt ? [Math.round(lambda) - 1, Math.round(lambda)] : [Math.floor(lambda)],
      sample: (seed, i) => {
        const u = uni(seed, 30, i);
        let k = 0, pk = pmf[0], F = pk;
        while (F < u && k < top) { k++; pk = pmf[k]; F += pk; }
        return k;
      },
    };
  }
  if (index === 3) {
    const h = sigma * Math.sqrt(3); // uniform on [−h, h] with standard deviation σ
    return {
      name: `Uniform[−${r6(h)}, ${r6(h)}] (σ = ${sigma})`, discrete: false, range: [-1.25 * h, 1.25 * h],
      pdf: (x) => (Math.abs(x) <= h ? 1 / (2 * h) : 0), cdf: (x) => Math.min(1, Math.max(0, (x + h) / (2 * h))),
      mean: 0, variance: sigma * sigma, skew: 0, exkurt: -6 / 5, median: 0, mode: 'every point of [−h, h]',
      pdfPolyline: () => ({ x: [-1.25 * h, -h, -h, h, h, 1.25 * h], y: [0, 0, 1 / (2 * h), 1 / (2 * h), 0, 0] }),
      sample: (seed, i) => -h + 2 * h * uni(seed, 40, i),
    };
  }
  if (index === 4) {
    return {
      name: `Exponential(λ = ${lambda})`, discrete: false, range: [0, 7 / lambda],
      pdf: (x) => (x < 0 ? 0 : lambda * Math.exp(-lambda * x)), cdf: (x) => (x < 0 ? 0 : 1 - Math.exp(-lambda * x)),
      mean: 1 / lambda, variance: 1 / lambda ** 2, skew: 2, exkurt: 6, median: Math.LN2 / lambda, mode: [0],
      sample: (seed, i) => -Math.log(uni(seed, 50, i)) / lambda,
    };
  }
  return {
    name: `Normal(a = 0, σ = ${sigma})`, discrete: false, range: [-4 * sigma, 4 * sigma],
    pdf: (x) => normPdf(x / sigma) / sigma, cdf: (x) => Phi(x / sigma),
    mean: 0, variance: sigma * sigma, skew: 0, exkurt: 0, median: 0, mode: [0],
    sample: (seed, i) => sigma * gauss(seed, 60, i),
  };
}

/** Exact P(|ξ − Mξ| < kσ) for a law (strict inequality, as in L6 formula (40)). */
export function sigmaRule(law, k) {
  const s = Math.sqrt(law.variance), a = law.mean - k * s, b = law.mean + k * s;
  if (law.discrete) return law.support.reduce((acc, x, i) => (x > a && x < b ? acc + law.pmf[i] : acc), 0);
  return law.cdf(b) - law.cdf(a);
}

/** Median of a discrete law: the smallest x with F(x) ≥ 1/2 (any point of a flat stretch is a median). */
function discreteMedian(law) {
  let F = 0;
  for (let i = 0; i < law.support.length; i++) {
    F += law.pmf[i];
    if (F >= 0.5 - 1e-12) return { value: law.support[i], flat: Math.abs(F - 0.5) < 1e-12 };
  }
  return { value: law.support.at(-1), flat: false };
}

/** Moments with stated divisors: mean, s² (n − 1), and m₂, m₃, m₄ (divisor n) for Sk and Ek. */
export function sampleMoments(xs) {
  const n = xs.length;
  let mean = 0;
  for (const x of xs) mean += x;
  mean /= n;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const x of xs) { const d = x - mean, d2 = d * d; m2 += d2; m3 += d2 * d; m4 += d2 * d2; }
  const s2 = m2 / (n - 1);
  m2 /= n; m3 /= n; m4 /= n;
  return { n, mean, s2, m2, skew: m2 > 0 ? m3 / m2 ** 1.5 : null, exkurt: m2 > 0 ? m4 / (m2 * m2) - 3 : null };
}
const sampleMedian = (sorted) => {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
};
const modeText = (mode) => (typeof mode === 'string' ? mode : mode.join(' and '));

/** Histogram on [lo, hi] with `bins` equal bins; returns starts, densities and outside count. */
function histogram(xs, lo, hi, bins) {
  const w = (hi - lo) / bins, counts = new Array(bins).fill(0);
  let outside = 0;
  for (const x of xs) {
    const b = Math.floor((x - lo) / w);
    if (b >= 0 && b < bins) counts[b]++;
    else if (x === hi) counts[bins - 1]++;
    else outside++;
  }
  return { w, counts, outside, x: counts.map((_, i) => lo + i * w), y: counts.map((c) => c / (xs.length * w)) };
}

// ---------------------------------------------------------------- Moments (L6)

const lawParam = { key: 'law', label: 'Law (0 Bernoulli · 1 Binomial · 2 Poisson · 3 Uniform · 4 Exponential · 5 Normal)', min: 0, max: 5, step: 1, default: 5 };
const momentsParams = [
  lawParam,
  { key: 'p', label: 'Success probability p (laws 0–1)', min: 0.05, max: 0.95, step: 0.05, default: 0.3 },
  { key: 'm', label: 'Trials m (law 1)', min: 1, max: 30, step: 1, default: 10 },
  { key: 'lambda', label: 'Rate λ (laws 2, 4)', min: 0.2, max: 8, step: 0.1, default: 2 },
  { key: 'sigma', label: 'Standard deviation σ (laws 3, 5)', min: 0.5, max: 3, step: 0.1, default: 1 },
  { key: 'n', label: 'Sample size n', min: 100, max: 20000, step: 100, default: 5000 },
];

/** Lecture Table 3 (L6, 3σ rule) as printed, for the normal law. */
export const LECTURE_TABLE_3 = { 1: 0.6826, 2: 0.9544, 3: 0.9973, 4: 0.9997 };

function runMoments({ law: li, p, m, lambda, sigma, n }, seed) {
  const law = makeLaw(li, { p, m, lambda, sigma });
  const xs = Array.from({ length: n }, (_, i) => law.sample(seed, i));
  const sm = sampleMoments(xs);
  const sorted = [...xs].sort((a, b) => a - b);
  const sd = Math.sqrt(law.variance);
  const series = [];
  let medTheory, medConvention, modeObserved;
  if (law.discrete) {
    const freq = law.support.map(() => 0);
    for (const x of xs) freq[x]++;
    const shown = law.support.filter((k, i) => i <= law.mean + 6 * sd + 2 || law.pmf[i] > 1e-4);
    series.push({ id: 'freq', kind: 'hist', label: 'Sample frequency nₖ/n', x: shown.map((k) => k - 0.5), y: shown.map((k) => freq[k] / n) });
    series.push({ id: 'pmf', kind: 'pmf', tone: 'signal', label: 'P(ξ = k)', x: shown, y: shown.map((k) => law.pmf[k]) });
    const best = Math.max(...freq);
    modeObserved = freq.flatMap((f, k) => (f === best ? [k] : [])).join(' and ');
    const med = discreteMedian(law);
    medTheory = med.value;
    medConvention = med.flat ? 'F(x) = 1/2 on a whole step: every point up to the next value is a median; shown is the smallest' : 'smallest x with F(x) ≥ 1/2';
  } else {
    const [lo, hi] = law.range, bins = 40;
    const h = histogram(xs, lo, hi, bins);
    series.push({ id: 'hist', kind: 'hist', label: 'Sample histogram (density scale)', x: h.x, y: h.y });
    const curve = law.pdfPolyline ? law.pdfPolyline() : (() => { const x = grid(lo, hi, 241); return { x, y: x.map(law.pdf) }; })();
    series.push({ id: 'pdf', kind: 'pdf', tone: 'signal', label: 'Density f(x)', x: curve.x, y: curve.y });
    const top = h.counts.indexOf(Math.max(...h.counts));
    modeObserved = r6(lo + (top + 0.5) * h.w);
    medTheory = law.median;
    medConvention = 'F(x) = 1/2';
  }
  series.push({ id: 'sigma-rules', kind: 'rule', tone: 'muted', label: 'M ± σ, 2σ, 3σ', x: [-3, -2, -1, 1, 2, 3].map((k) => law.mean + k * sd), y: [] });
  series.push({ id: 'mean', kind: 'rule', tone: 'accent', label: 'Mξ', x: [law.mean], y: [] });

  const within = (k) => xs.reduce((c, x) => (Math.abs(x - law.mean) < k * sd ? c + 1 : c), 0) / n;
  const readouts = [
    { key: 'mean', label: 'Expectation Mξ', observed: r6(sm.mean), theory: r6(law.mean), convention: 'sample mean x̄' },
    { key: 'variance', label: 'Variance Dξ', observed: r6(sm.s2), theory: r6(law.variance), convention: 's², divisor n − 1' },
    { key: 'sd', label: 'Standard deviation σ', observed: r6(Math.sqrt(sm.s2)), theory: r6(sd) },
    { key: 'median', label: 'Median', observed: r6(sampleMedian(sorted)), theory: r6(medTheory), convention: medConvention },
    { key: 'mode', label: 'Mode', observed: modeObserved, theory: modeText(law.mode), convention: law.discrete ? 'most frequent sample value' : 'centre of the tallest of 40 histogram bins' },
    { key: 'skew', label: 'Skewness Sk = μ₃/σ³', observed: r6(sm.skew), theory: r6(law.skew), convention: 'm₃/m₂^1.5, central moments with divisor n' },
    { key: 'exkurt', label: 'Excess kurtosis Ek = μ₄/σ⁴ − 3', observed: r6(sm.exkurt), theory: r6(law.exkurt), convention: 'm₄/m₂² − 3, divisor n' },
  ];
  for (const k of [1, 2, 3, 4])
    readouts.push({ key: `rule${k}`, label: `P(|ξ − Mξ| < ${k}σ)`, observed: r6(within(k)), theory: r6(sigmaRule(law, k)), convention: 'sample share; theory exact' });

  const notes = [
    `${law.name}: Mξ, Dξ, Sk and Ek are the closed forms of L6; the sample uses n = ${n}, seed ${seed}.`,
    'The 3σ rule (formula (40)): for the normal law P(|ξ − a| < 3σ) = 1 − 2Φ(−3) = 0.9973. Both tails count: 2 · 0.00135 = 0.0027 (L6 writes "1 − 0.00135").',
  ];
  if (li === 5) notes.push('L6 Table 3 prints 0.9997 for 4σ; the exact value is 0.99994. Its "% outside" column (32 %, 5 %, 0.7 %, 0.07 %) should read 31.7 %, 4.6 %, 0.27 %, 0.006 %.');
  if (li !== 5) notes.push('The 3σ rule is a property of the normal law. For this law the exact share inside 3σ is shown in the table and may differ from 0.9973.');
  if (law.discrete) notes.push('For a discrete law the bars are sample frequencies at each value k, the stems are P(ξ = k).');
  return { axes: { x: 'value x', y: law.discrete ? 'probability' : 'density f(x)' }, readouts, series, notes };
}

// ---------------------------------------------------------------- Transform (L6 §Functions of a random variable)

const transformParams = [
  { key: 'phi', label: 'Function (0 αx + b · 1 eˣ · 2 e^(−βx) · 3 x², x ≥ 0)', min: 0, max: 3, step: 1, default: 2 },
  { key: 'alpha', label: 'Slope α (function 0)', min: -3, max: 3, step: 0.5, default: 2 },
  { key: 'b', label: 'Shift b (function 0)', min: -2, max: 2, step: 0.5, default: 1 },
  { key: 'beta', label: 'Exponent β (function 2)', min: 0.25, max: 4, step: 0.25, default: 1 },
  { key: 'lambda', label: 'Rate λ of ξ ~ Exp(λ) (functions 2, 3)', min: 0.2, max: 4, step: 0.1, default: 2 },
  { key: 'sigma', label: 'σ of ξ ~ N(0, σ) (functions 0, 1)', min: 0.2, max: 1.5, step: 0.1, default: 0.5 },
  { key: 'n', label: 'Sample size n', min: 100, max: 20000, step: 100, default: 5000 },
];

/** η = φ(ξ) for strictly monotone φ: density by formula (44), f_η(y) = f_ξ(φ⁻¹(y)) · |dφ⁻¹/dy|. */
export function makeTransform({ phi, alpha, b, beta, lambda, sigma }) {
  if (phi === 0) {
    if (alpha === 0) throw new Error('α = 0 makes η constant: formula (44) needs a strictly monotone φ.');
    const s = Math.abs(alpha) * sigma;
    return {
      name: `η = ${alpha}ξ ${b < 0 ? '−' : '+'} ${Math.abs(b)}, ξ ~ N(0, ${sigma})`, source: 'normal',
      map: (x) => alpha * x + b, range: [b - 4 * s, b + 4 * s],
      pdf: (y) => normPdf((y - b) / alpha / sigma) / sigma / Math.abs(alpha),
      cdf: (y) => Phi((y - b) / s), mean: b,
    };
  }
  if (phi === 1)
    return {
      name: `η = e^ξ, ξ ~ N(0, ${sigma})`, source: 'normal', map: Math.exp, range: [0, Math.exp(2.6 * sigma)],
      pdf: (y) => (y <= 0 ? 0 : normPdf(Math.log(y) / sigma) / (sigma * y)), cdf: (y) => (y <= 0 ? 0 : Phi(Math.log(y) / sigma)),
      mean: Math.exp((sigma * sigma) / 2),
    };
  if (phi === 2) {
    const g = lambda / beta;
    return {
      name: `η = e^(−${beta}ξ), ξ ~ Exp(${lambda})`, source: 'exponential', map: (x) => Math.exp(-beta * x), range: [0, 1],
      pdf: (y) => (y <= 0 || y > 1 ? 0 : g * y ** (g - 1)), cdf: (y) => (y <= 0 ? 0 : y >= 1 ? 1 : y ** g),
      mean: lambda / (lambda + beta), unboundedAtZero: g < 1,
    };
  }
  const top = (Math.log(100) / lambda) ** 2;
  return {
    name: `η = ξ², ξ ~ Exp(${lambda}) (monotone on ξ ≥ 0)`, source: 'exponential', map: (x) => x * x, range: [0, top],
    pdf: (y) => (y <= 0 ? 0 : (lambda * Math.exp(-lambda * Math.sqrt(y))) / (2 * Math.sqrt(y))),
    cdf: (y) => (y <= 0 ? 0 : 1 - Math.exp(-lambda * Math.sqrt(y))), mean: 2 / lambda ** 2, unboundedAtZero: true,
  };
}

function runTransform(params, seed) {
  const t = makeTransform(params);
  const { n, lambda, sigma } = params;
  const ys = Array.from({ length: n }, (_, i) => t.map(t.source === 'normal' ? sigma * gauss(seed, 70, i) : -Math.log(uni(seed, 72, i)) / lambda));
  const [lo, hi] = t.range, bins = 40;
  const h = histogram(ys, lo, hi, bins);
  // Expected bin densities from CDF differences: exact even where f is unbounded at 0.
  const expected = h.x.map((a) => (t.cdf(a + h.w) - t.cdf(a)) / h.w);
  const cap = 1.6 * Math.max(...expected, ...h.y);
  const xg = grid(lo + (hi - lo) / 2000, hi, 241);
  const fy = xg.map((y) => Math.min(cap, t.pdf(y)));
  const sorted = [...ys].sort((a, b) => a - b);
  let D = 0;
  for (let i = 0; i < n; i++) { const F = t.cdf(sorted[i]); D = Math.max(D, (i + 1) / n - F, F - i / n); }
  let worst = 0;
  for (let i = 0; i < bins; i++) {
    const pr = expected[i] * h.w, se = Math.sqrt((pr * (1 - pr)) / n) / h.w;
    if (n * pr >= 5) worst = Math.max(worst, Math.abs(h.y[i] - expected[i]) / se);
  }
  const sm = sampleMoments(ys);
  const readouts = [
    { key: 'mean', label: 'Mη', observed: r6(sm.mean), theory: r6(t.mean), convention: 'sample mean' },
    { key: 'ks', label: 'Kolmogorov distance sup|Fₙ(y) − F(y)|', observed: r6(D), theory: r6(1.358 / Math.sqrt(n)), convention: 'theory column: 95 % critical value 1.358/√n' },
    { key: 'bins', label: 'Largest bin deviation, in standard errors', observed: r6(worst), theory: '≤ 3.5 expected', convention: '40 bins with expected count ≥ 5, expected mass from F' },
    { key: 'mass', label: 'Share of η inside the shown range', observed: r6(1 - h.outside / n), theory: r6(t.cdf(hi) - t.cdf(lo)) },
  ];
  if (params.phi === 2) {
    const y0 = 0.5, g = params.lambda / params.beta;
    readouts.push({ key: 'F05', label: 'F(0.5) = 0.5^(λ/β) (L6 example)', observed: r6(ys.filter((y) => y < y0).length / n), theory: r6(y0 ** g), convention: 'share of η < 0.5' });
  }
  const notes = [
    `${t.name}. The curve is formula (44): f_η(y) = f_ξ(φ⁻¹(y)) · |dφ⁻¹(y)/dy|, valid for strictly monotone φ.`,
    'The dots are the expected bin heights (F(b) − F(a))/width, so the comparison stays exact where the density is unbounded.',
  ];
  if (params.phi === 2) notes.push(`L6 example: η = e^(−βξ), ξ ~ Exp(λ) gives F(y) = y^(λ/β) on [0, 1]; here λ/β = ${r6(params.lambda / params.beta)}.`);
  if (t.unboundedAtZero) notes.push(`f_η(y) → ∞ as y → 0; the drawn curve is cut at ${r6(cap)}.`);
  if (params.phi === 3) notes.push('x² is not monotone on ℝ; it is monotone on the support x ≥ 0 of Exp(λ), so (44) applies with one branch.');
  return {
    axes: { x: 'value y of η', y: 'density' }, readouts, notes,
    series: [
      { id: 'hist', kind: 'hist', label: 'Histogram of η = φ(ξ)', x: h.x, y: h.y },
      { id: 'pdf', kind: 'pdf', tone: 'signal', label: 'f_η(y), formula (44)', x: xg, y: fy },
      { id: 'expected', kind: 'points', tone: 'signal', label: 'Expected bin height', x: h.x.map((a) => a + h.w / 2), y: expected },
    ],
  };
}

// ---------------------------------------------------------------- Scatter (L6 §Random vectors, correlation, regression, lottery)

const scatterParams = [
  { key: 'mode', label: 'Experiment (0 bivariate normal · 1 uniform disc · 2 matching problem)', min: 0, max: 2, step: 1, default: 0 },
  { key: 'rho', label: 'Correlation ρ (experiment 0)', min: -0.95, max: 0.95, step: 0.05, default: 0.6 },
  { key: 'sigma2', label: 'σ of η (experiment 0; σ of ξ is 1)', min: 0.5, max: 2, step: 0.1, default: 1 },
  { key: 'n', label: 'Points n (experiments 0, 1)', min: 200, max: 20000, step: 100, default: 2000 },
  { key: 'players', label: 'Players n (experiment 2)', min: 2, max: 40, step: 1, default: 6 },
  { key: 'reps', label: 'Lottery draws (experiment 2)', min: 200, max: 10000, step: 100, default: 4000 },
];
const SHOWN_POINTS = 1500;
const Z99 = 2.5758293035489;

/** Sample statistics of a vector with divisor n − 1, and the regression lines (63), (64) built from them. */
export function vectorStats(xs, ys) {
  const n = xs.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  const cov = sxy / (n - 1), sx = Math.sqrt(sxx / (n - 1)), sy = Math.sqrt(syy / (n - 1));
  const r = cov / (sx * sy);
  return { n, mx, my, sx, sy, cov, r, slopeYonX: (r * sy) / sx, slopeXonY: (r * sx) / sy };
}
/** Acute angle between lines (63) and (64): tan θ = (1 − r²)σ₁σ₂ / (|r|(σ₁² + σ₂²)); 90° when r = 0. */
export const regressionAngle = (r, s1, s2) =>
  r === 0 ? 90 : (Math.atan(((1 - r * r) * s1 * s2) / (Math.abs(r) * (s1 * s1 + s2 * s2))) * 180) / Math.PI;

function surfaceGrid(xs, ys, [x0, x1], [y0, y1], N, density, labels) {
  const gx = grid(x0, x1, N), gy = grid(y0, y1, N), dx = gx[1] - gx[0], dy = gy[1] - gy[0];
  const counts = gy.map(() => gx.map(() => 0));
  for (let k = 0; k < xs.length; k++) {
    const i = Math.round((xs[k] - x0) / dx), j = Math.round((ys[k] - y0) / dy);
    if (i >= 0 && i < N && j >= 0 && j < N) counts[j][i]++;
  }
  return {
    x: gx.map(r6), y: gy.map(r6), labels,
    z: gy.map((y) => gx.map((x) => r6(density(x, y)))),
    zSample: counts.map((row) => row.map((c) => r6(c / (xs.length * dx * dy)))),
  };
}

function runVector({ mode, rho, sigma2, n }, seed) {
  const xs = new Array(n), ys = new Array(n);
  if (mode === 0) {
    const c = Math.sqrt(1 - rho * rho);
    for (let i = 0; i < n; i++) {
      const z1 = gauss(seed, 80, i), z2 = gauss(seed, 82, i);
      xs[i] = z1; ys[i] = sigma2 * (rho * z1 + c * z2);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(uni(seed, 90, i)), th = 2 * Math.PI * uni(seed, 91, i);
      xs[i] = r * Math.cos(th); ys[i] = r * Math.sin(th);
    }
  }
  const st = vectorStats(xs, ys);
  const theoryR = mode === 0 ? rho : 0;
  const zr = Math.atanh(theoryR), half = Z99 / Math.sqrt(n - 3);
  const band = [Math.tanh(zr - half), Math.tanh(zr + half)];
  const X = mode === 0 ? 3.5 : 1.1, Y = mode === 0 ? 3.5 * sigma2 : 1.1;
  const xl = grid(-X, X, 2), yl = grid(-Y, Y, 2);
  const series = [
    { id: 'points', kind: 'points', label: `Sample (first ${Math.min(n, SHOWN_POINTS)} of ${n})`, x: xs.slice(0, SHOWN_POINTS).map(r6), y: ys.slice(0, SHOWN_POINTS).map(r6) },
  ];
  // Line (63): y = r σ₂/σ₁ (x − Mξ) + Mη. Line (64): x = r σ₁/σ₂ (y − Mη) + Mξ, drawn as points (x(y), y).
  const yOnX = (k, mx, my) => ({ x: xl, y: xl.map((x) => my + k * (x - mx)) });
  const xOnY = (k, mx, my) => ({ x: yl.map((y) => mx + k * (y - my)), y: yl });
  const thY = yOnX(mode === 0 ? (rho * sigma2) : 0, 0, 0);
  series.push({ id: 'reg-yx-theory', kind: 'line', tone: 'signal', label: 'Line (63), theory: η on ξ', ...thY });
  if (mode === 0 && rho !== 0) series.push({ id: 'reg-xy-theory', kind: 'line', tone: 'signal', label: 'Line (64), theory: ξ on η', ...xOnY(rho / sigma2, 0, 0) });
  else series.push({ id: 'reg-xy-theory-rule', kind: 'rule', tone: 'signal', label: 'Line (64), theory: x = Mξ (vertical, r = 0)', x: [0], y: [] });
  series.push({ id: 'reg-yx', kind: 'line', tone: 'accent', label: 'Line (63) from the sample', ...yOnX(st.slopeYonX, st.mx, st.my) });
  series.push({ id: 'reg-xy', kind: 'line', tone: 'accent', label: 'Line (64) from the sample', ...xOnY(st.slopeXonY, st.mx, st.my) });

  let readouts, notes, surface, inside;
  if (mode === 0) {
    // Ellipse of dispersion Q(x, y) = c² with c = 2: P(inside) = 1 − e^(−c²/2) for a bivariate normal.
    const t = grid(0, 2 * Math.PI, 121), c = 2, L = Math.sqrt(1 - rho * rho);
    series.push({ id: 'ellipse', kind: 'line', tone: 'muted', label: 'Ellipse of dispersion, c = 2', x: t.map((a) => c * Math.cos(a)), y: t.map((a) => sigma2 * c * (rho * Math.cos(a) + L * Math.sin(a))) });
    const Q = (x, y) => (x * x - (2 * rho * x * y) / sigma2 + (y * y) / (sigma2 * sigma2)) / (1 - rho * rho);
    inside = xs.reduce((k, x, i) => (Q(x, ys[i]) < c * c ? k + 1 : k), 0) / n;
    const dens = (x, y) => Math.exp(-Q(x, y) / 2) / (2 * Math.PI * sigma2 * L);
    surface = surfaceGrid(xs, ys, [-X, X], [-Y, Y], 31, dens, { x: 'ξ', y: 'η', z: 'density f(x, y)' });
    surface.title = `Joint density of (ξ, η), ρ = ${rho}`;
    readouts = [
      { key: 'cov', label: 'Cov(ξ, η)', observed: r6(st.cov), theory: r6(rho * sigma2), convention: 'divisor n − 1' },
      { key: 'r', label: 'Correlation r(ξ, η)', observed: r6(st.r), theory: rho, convention: `99 % band ${r6(band[0])} … ${r6(band[1])} (Fisher z)` },
      { key: 'slope63', label: 'Slope of (63): r σ₂/σ₁', observed: r6(st.slopeYonX), theory: r6(rho * sigma2) },
      { key: 'slope64', label: 'Slope of (64) as dx/dy: r σ₁/σ₂', observed: r6(st.slopeXonY), theory: r6(rho / sigma2) },
      { key: 'angle', label: 'Acute angle between (63) and (64)', observed: r6(regressionAngle(st.r, st.sx, st.sy)), theory: r6(regressionAngle(rho, 1, sigma2)), unit: '°' },
      { key: 'ellipse', label: 'Share inside the c = 2 ellipse', observed: r6(inside), theory: r6(1 - Math.exp(-2)) },
    ];
    notes = [
      'Lines (63) and (64) differ unless |r| = 1; the angle between them shrinks as |r| grows and is 90° at r = 0.',
      'The 3D view puts the theoretical density f(x, y) and the sample\'s 2D histogram on the same grid.',
      'L6 leaves the least-squares check as an exercise; the sample lines here are the least-squares fits, and they coincide with (63)–(64) built from sample moments.',
    ];
  } else {
    let ex2 = 0, ey2 = 0;
    for (let i = 0; i < n; i++) { ex2 += xs[i] ** 2; ey2 += ys[i] ** 2; }
    const sq = vectorStats(xs.map((x) => x * x), ys.map((y) => y * y));
    const a = 0.75, tail = (2 / Math.PI) * (Math.acos(a) - a * Math.sqrt(1 - a * a));
    const both = xs.reduce((k, x, i) => (Math.abs(x) > a && Math.abs(ys[i]) > a ? k + 1 : k), 0) / n;
    const t = grid(0, 2 * Math.PI, 121);
    series.push({ id: 'disc', kind: 'line', tone: 'muted', label: 'Disc x² + y² = 1', x: t.map(Math.cos), y: t.map(Math.sin) });
    surface = surfaceGrid(xs, ys, [-X, X], [-Y, Y], 31, (x, y) => (x * x + y * y <= 1 ? 1 / Math.PI : 0), { x: 'ξ', y: 'η', z: 'density f(x, y)' });
    surface.title = 'Uniform density on the unit disc';
    readouts = [
      { key: 'cov', label: 'Cov(ξ, η)', observed: r6(st.cov), theory: 0, convention: 'divisor n − 1' },
      { key: 'r', label: 'Correlation r(ξ, η)', observed: r6(st.r), theory: 0, convention: `99 % band ${r6(band[0])} … ${r6(band[1])}` },
      { key: 'r2', label: 'Correlation of ξ² and η²', observed: r6(sq.r), theory: r6(-1 / 3), convention: 'nonzero: ξ and η are dependent' },
      { key: 'joint', label: 'P(|ξ| > 0.75 and |η| > 0.75)', observed: r6(both), theory: 0, convention: 'the corner lies outside the disc' },
      { key: 'product', label: 'P(|ξ| > 0.75) · P(|η| > 0.75)', observed: r6((xs.filter((x) => Math.abs(x) > a).length / n) * (ys.filter((y) => Math.abs(y) > a).length / n)), theory: r6(tail * tail), convention: 'what independence would require' },
    ];
    notes = [
      'L6: for the uniform disc Cov(ξ, η) = 0, yet ξ and η are dependent: |ξ| close to 1 forces η close to 0.',
      'The joint probability of the corners is 0, while the product of the marginals is not: the definition of independence fails.',
      `Mean of ξ² is ${r6(ex2 / n)} (theory 1/4), of η² ${r6(ey2 / n)} (theory 1/4).`,
    ];
  }
  return { axes: { x: 'x (value of ξ)', y: 'y (value of η)' }, readouts, series, notes, surface };
}

/** Exact P(M = k) for the number of fixed points of a random permutation of n: (1/k!) Σⱼ₌₀ⁿ⁻ᵏ (−1)ʲ/j!. */
export function matchPmf(n) {
  const fact = [1];
  for (let i = 1; i <= n; i++) fact.push(fact[i - 1] * i);
  return Array.from({ length: n + 1 }, (_, k) => {
    let s = 0;
    for (let j = 0; j <= n - k; j++) s += (j % 2 ? -1 : 1) / fact[j];
    return s / fact[k];
  });
}

/** Fixed points of one seeded Fisher–Yates shuffle of n cards (draw r uses indices r·64 + i). */
export function shuffleMatches(seed, r, n) {
  const perm = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(uni(seed, 100, r * 64 + i) * (i + 1)));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  return perm.reduce((c, v, i) => (v === i ? c + 1 : c), 0);
}

/** Predeclared bands for the lottery: 3.5 standard errors of the mean and of s² (exact μ₄ per n). */
export function matchBands(n, reps) {
  const pmf = matchPmf(n);
  const mu4 = pmf.reduce((s, p, k) => s + p * (k - 1) ** 4, 0);
  return {
    mu4,
    mean: 3.5 * Math.sqrt(1 / reps),
    // Var(s²) = (μ₄ − σ⁴)/K + 2σ⁴/(K(K − 1)); plus 12/K for the χ²-shaped n = 2 case where μ₄ = σ⁴.
    variance: 3.5 * Math.sqrt((mu4 - 1) / reps + 2 / (reps * (reps - 1))) + 12 / reps,
  };
}

function runMatching({ players: n, reps }, seed) {
  const counts = new Array(n + 1).fill(0), ms = new Array(reps);
  for (let r = 0; r < reps; r++) { ms[r] = shuffleMatches(seed, r, n); counts[ms[r]]++; }
  const sm = sampleMoments(ms);
  const pmf = matchPmf(n), bands = matchBands(n, reps);
  const ks = Array.from({ length: n + 1 }, (_, k) => k);
  const last = Math.min(n, Math.max(8, counts.findLastIndex((c) => c > 0)));
  const shown = ks.slice(0, last + 1);
  const fact = (k) => (k <= 1 ? 1 : k * fact(k - 1));
  const poisson = shown.map((k) => Math.exp(-1) / fact(k));
  return {
    axes: { x: 'number of matches k', y: 'probability' },
    readouts: [
      { key: 'mean', label: 'Mean number of prizes Mμ', observed: r6(sm.mean), theory: 1, convention: `band ±${r6(bands.mean)}` },
      { key: 'variance', label: 'Variance Dμ', observed: r6(sm.s2), theory: 1, convention: `s², divisor K − 1; band ±${r6(bands.variance)}` },
      { key: 'p0', label: 'P(no prize)', observed: r6(counts[0] / reps), theory: r6(pmf[0]), convention: `→ 1/e = ${r6(Math.exp(-1))}` },
      { key: 'draws', label: 'Lottery draws K', observed: reps, theory: null },
    ],
    series: [
      { id: 'freq', kind: 'hist', label: 'Share of draws with k matches', x: shown.map((k) => k - 0.5), y: shown.map((k) => counts[k] / reps) },
      { id: 'pmf', kind: 'pmf', tone: 'signal', label: 'Exact P(μ = k)', x: shown, y: shown.map((k) => pmf[k]) },
      { id: 'poisson', kind: 'points', tone: 'muted', label: 'Poisson(1) limit', x: shown, y: poisson },
    ],
    notes: [
      `L6 lottery: μ = Σ μₖ, Mμₖ = 1/n, so Mμ = 1 for every n; with Cov(μᵢ, μⱼ) = 1/(n²(n − 1)) the variance is also 1 (n = ${n}, ${reps} seeded shuffles).`,
      'L6 then adds "M + D = 1 + 1 = 2 prizes". Mean plus variance mixes units; the usual allowance is M + σ = 1 + 1 = 2, which gives the same number only because D = σ = 1.',
    ],
  };
}

// ---------------------------------------------------------------- contract

export const meta = {
  id: 'lecture-random-vectors',
  lectures: ['L5', 'L6'],
  title: 'Moments, the 3σ rule, functions of a random variable, correlation and regression',
  params: momentsParams,
};

export const stations = {
  moments: { params: momentsParams, live: true },
  transform: { params: transformParams, live: true },
  scatter: { params: scatterParams, live: true },
};

export function run(params, { seed, station = 'moments' } = {}) {
  const s = seed >>> 0;
  if (station === 'transform') return runTransform(params, s);
  if (station === 'scatter') return params.mode === 2 ? runMatching(params, s) : runVector(params, s);
  return runMoments(params, s);
}

export { LAW_NAMES };
