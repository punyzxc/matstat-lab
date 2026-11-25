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
const LAW_NAMES = ['Bernoulli', 'Binomial', 'Poisson', 'Uniform', 'Exponential', 'Normal', 'Gamma', 'Beta'];

// ---------------------------------------------------------------- Special functions for the gamma and beta laws (#132)

const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
/** ln Γ(x) for x > 0 (Lanczos, g = 7): about 15 significant digits. */
export function lnGamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += LANCZOS[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
/** Regularized lower incomplete gamma P(k, x): the series below k + 1, Lentz's continued fraction above. */
export function gammaP(k, x) {
  if (x <= 0) return 0;
  const lead = k * Math.log(x) - x - lnGamma(k);
  if (x < k + 1) {
    let term = 1 / k, sum = term;
    for (let n = 1; n < 500 && Math.abs(term) > Math.abs(sum) * 1e-15; n++) { term *= x / (k + n); sum += term; }
    return Math.min(1, sum * Math.exp(lead));
  }
  let b = x + 1 - k, c = 1e300, d = 1 / b, h = d;
  for (let n = 1; n < 500; n++) {
    const an = -n * (n - k);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.max(0, 1 - Math.exp(lead) * h);
}
function betaCf(a, b, x) {
  let c = 1, d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-300) d = 1e-300;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}
/** Regularized incomplete beta I_x(a, b). */
export function betaI(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaCf(a, b, x)) / a : 1 - (front * betaCf(b, a, 1 - x)) / b;
}
/** The point where a continuous cdf reaches q, by bisection on [lo, hi]. */
function quantile(cdf, q, lo, hi) {
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (cdf(mid) < q) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/**
 * A Gamma(k, 1) draw from fixture streams (Marsaglia–Tsang). Attempt j of draw i reads index 64i + j, so the
 * rejection loop stays deterministic; k < 1 uses Gamma(k + 1)·U^(1/k).
 */
function gammaDraw(seed, stream, i, k) {
  if (k < 1) return gammaDraw(seed, stream, i, k + 1) * uni(seed, stream + 3, i) ** (1 / k);
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (let j = 0; j < 64; j++) {
    const z = gauss(seed, stream, 64 * i + j), v = (1 + c * z) ** 3;
    if (v <= 0) continue;
    const u = uni(seed, stream + 2, 64 * i + j); // gauss reads stream and stream + 1
    if (Math.log(u) < 0.5 * z * z + d - d * v + d * Math.log(v)) return d * v;
  }
  return d; // never reached in practice: acceptance is above 95 % for every k ≥ 1
}

/**
 * The six lecture laws (L5 §Main distributions; moments from L6).
 * Discrete laws carry their full support and PMF; continuous ones a pdf, cdf and display range.
 */
export function makeLaw(index, { p, m, lambda, sigma, a = 2, b = 1 }) {
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
      name: index === 0 ? `Bernoulli ($p = ${p}$)` : `Binomial ($m = ${trials}$, $p = ${p}$)`, discrete: true, support, pmf,
      mean: trials * p, variance: npq, skew: (q - p) / Math.sqrt(npq), exkurt: (1 - 6 * p * q) / npq, mode,
      sample: (seed, i) => {
        let s = 0;
        for (let t = 0; t < trials; t++) if (uni(seed, 20 + t, i) < p) s++;
        return s;
      },
    };
  }
  if (index === 2) {
    const top = Math.ceil(Math.max(lambda + 12 * Math.sqrt(lambda) + 12, 30));
    const support = Array.from({ length: top + 1 }, (_, k) => k);
    const pmf = [Math.exp(-lambda)];
    for (let k = 0; k < top; k++) pmf.push((pmf[k] * lambda) / (k + 1));
    const isInt = Math.abs(lambda - Math.round(lambda)) < 1e-9;
    return {
      name: `Poisson ($\\lambda = ${lambda}$)`, discrete: true, support, pmf,
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
      name: `Uniform on $[-${r6(h)}, ${r6(h)}]$ ($\\sigma = ${sigma}$)`, discrete: false, range: [-6.5, 6.5], bins: 65,
      pdf: (x) => (Math.abs(x) <= h ? 1 / (2 * h) : 0), cdf: (x) => Math.min(1, Math.max(0, (x + h) / (2 * h))),
      mean: 0, variance: sigma * sigma, skew: 0, exkurt: -6 / 5, median: 0, mode: 'every point of $[-h, h]$',
      pdfPolyline: () => ({ x: [-6.5, -h, -h, h, h, 6.5], y: [0, 0, 1 / (2 * h), 1 / (2 * h), 0, 0] }),
      sample: (seed, i) => -h + 2 * h * uni(seed, 40, i),
    };
  }
  if (index === 4) {
    return {
      name: `Exponential ($\\lambda = ${lambda}$)`, discrete: false, range: [0, 10], bins: 100,
      pdf: (x) => (x < 0 ? 0 : lambda * Math.exp(-lambda * x)), cdf: (x) => (x < 0 ? 0 : 1 - Math.exp(-lambda * x)),
      mean: 1 / lambda, variance: 1 / lambda ** 2, skew: 2, exkurt: 6, median: Math.LN2 / lambda, mode: [0],
      sample: (seed, i) => -Math.log(uni(seed, 50, i)) / lambda,
    };
  }
  if (index === 6) {
    // Gamma(k, θ): shape k = a, scale θ = b. Moments: kθ, kθ², 2/√k, 6/k.
    const k = a, th = b, mean = k * th, sd = Math.sqrt(k) * th;
    const top = Math.max(10, Math.ceil((mean + 6 * sd) / 5) * 5);
    const cdf = (x) => (x <= 0 ? 0 : gammaP(k, x / th));
    return {
      name: `Gamma ($k = ${k}$, $\\theta = ${th}$)`, discrete: false, range: [0, top], bins: 100,
      pdf: (x) => (x <= 0 ? 0 : Math.exp((k - 1) * Math.log(x / th) - x / th - lnGamma(k)) / th), cdf,
      mean, variance: k * th * th, skew: 2 / Math.sqrt(k), exkurt: 6 / k,
      median: quantile(cdf, 0.5, 0, mean + 20 * sd), mode: k >= 1 ? [r6((k - 1) * th)] : '$0$ (the density is unbounded there)',
      formula: [
        `M\\xi = k\\theta = ${k} \\cdot ${th} = ${r6(mean)} \\qquad D\\xi = k\\theta^2 = ${r6(k * th * th)}`,
        `Sk = \\dfrac{2}{\\sqrt{k}} = ${r6(2 / Math.sqrt(k))} \\qquad Ek = \\dfrac{6}{k} = ${r6(6 / k)}`,
      ],
      sample: (seed, i) => th * gammaDraw(seed, 70, i, k),
    };
  }
  if (index === 7) {
    // Beta(α, β) on [0, 1] with α = a, β = b.
    const al = a, be = b, s = al + be;
    const mean = al / s, variance = (al * be) / (s * s * (s + 1));
    const skew = (2 * (be - al) * Math.sqrt(s + 1)) / ((s + 2) * Math.sqrt(al * be));
    const exkurt = (6 * ((al - be) ** 2 * (s + 1) - al * be * (s + 2))) / (al * be * (s + 2) * (s + 3));
    const cdf = (x) => betaI(al, be, x);
    const lnB = lnGamma(al) + lnGamma(be) - lnGamma(s);
    const mode = al > 1 && be > 1 ? [r6((al - 1) / (s - 2))]
      : al === 1 && be === 1 ? 'every point of $[0, 1]$'
        : al < 1 && be < 1 ? '$0$ and $1$ (the density is unbounded there)'
          : al <= 1 && be >= 1 ? [0] : [1];
    return {
      name: `Beta ($\\alpha = ${al}$, $\\beta = ${be}$)`, discrete: false, range: [0, 1], bins: 50,
      pdf: (x) => (x <= 0 || x >= 1 ? 0 : Math.exp((al - 1) * Math.log(x) + (be - 1) * Math.log(1 - x) - lnB)), cdf,
      mean, variance, skew, exkurt, median: quantile(cdf, 0.5, 0, 1), mode,
      formula: [
        `M\\xi = \\dfrac{\\alpha}{\\alpha + \\beta} = ${r6(mean)} \\qquad D\\xi = \\dfrac{\\alpha\\beta}{(\\alpha + \\beta)^2(\\alpha + \\beta + 1)} = ${r6(variance)}`,
        `Sk = \\dfrac{2(\\beta - \\alpha)\\sqrt{\\alpha + \\beta + 1}}{(\\alpha + \\beta + 2)\\sqrt{\\alpha\\beta}} = ${r6(skew)} \\qquad Ek = ${r6(exkurt)}`,
      ],
      sample: (seed, i) => { const x = gammaDraw(seed, 70, i, al), y = gammaDraw(seed, 74, i, be); return x / (x + y); },
    };
  }
  return {
    name: `Normal ($a = 0$, $\\sigma = ${sigma}$)`, discrete: false, range: [-9, 9], bins: 90,
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

const lawParam = { key: 'law', label: 'Law (0 Bernoulli · 1 Binomial · 2 Poisson · 3 Uniform · 4 Exponential · 5 Normal · 6 Gamma · 7 Beta)', min: 0, max: 7, step: 1, default: 5 };
const momentsParams = [
  lawParam,
  { key: 'p', label: 'Success probability $p$ (laws 0–1)', min: 0.05, max: 0.95, step: 0.05, default: 0.3 },
  { key: 'm', label: 'Trials $m$ (law 1)', min: 1, max: 30, step: 1, default: 10 },
  { key: 'lambda', label: 'Rate $\\lambda$ (laws 2, 4)', min: 0.2, max: 8, step: 0.1, default: 2 },
  { key: 'sigma', label: 'Standard deviation $\\sigma$ (laws 3, 5)', min: 0.5, max: 3, step: 0.1, default: 1 },
  { key: 'a', label: 'Shape: $k$ (law 6), $\\alpha$ (law 7)', min: 0.5, max: 10, step: 0.1, default: 2 },
  { key: 'b', label: 'Scale $\\theta$ (law 6), shape $\\beta$ (law 7)', min: 0.5, max: 10, step: 0.1, default: 2 },
  { key: 'n', label: 'Sample size $n$', min: 100, max: 20000, step: 100, default: 5000 },
];

/** Lecture Table 3 (L6, 3σ rule) as printed, for the normal law. */
export const LECTURE_TABLE_3 = { 1: 0.6826, 2: 0.9544, 3: 0.9973, 4: 0.9997 };

function runMoments({ law: li, p, m, lambda, sigma, a = 2, b = 2, n }, seed) {
  const law = makeLaw(li, { p, m, lambda, sigma, a, b });
  const xs = Array.from({ length: n }, (_, i) => law.sample(seed, i));
  const sm = sampleMoments(xs);
  const sorted = [...xs].sort((a, b) => a - b);
  const sd = Math.sqrt(law.variance);
  const series = [];
  let medTheory, medConvention, modeObserved, extraNote;
  if (law.discrete) {
    const freq = law.support.map(() => 0);
    for (const x of xs) freq[x]++;
    // Fixed support per law (Poisson: 0…27, enough for λ ≤ 8), so bars glide as the parameter moves.
    const shown = law.support.filter((k) => k <= 27);
    series.push({ id: 'freq', kind: 'hist', label: 'Sample frequency $n_k/n$', x: shown.map((k) => k - 0.5), y: shown.map((k) => freq[k] / n) });
    series.push({ id: 'pmf', kind: 'pmf', tone: 'signal', label: '$P(\\xi = k)$', x: shown, y: shown.map((k) => law.pmf[k]) });
    const best = Math.max(...freq);
    modeObserved = freq.flatMap((f, k) => (f === best ? [k] : [])).join(' and ');
    const med = discreteMedian(law);
    medTheory = med.value;
    medConvention = med.flat ? '$F(x) = \\tfrac12$ on a whole step: every point up to the next value is a median; shown is the smallest' : 'smallest $x$ with $F(x) \\ge \\tfrac12$';
  } else {
    const [lo, hi] = law.range, bins = law.bins;
    const h = histogram(xs, lo, hi, bins);
    series.push({ id: 'hist', kind: 'hist', label: 'Sample histogram (density scale)', x: h.x, y: h.y });
    // Cell midpoints, so an unbounded density at an end of the range (gamma k < 1, beta α < 1) stays finite.
    const curve = law.pdfPolyline ? law.pdfPolyline() : (() => { const x = grid(lo, hi, 241).map((v, i, g) => (i === 0 ? v + (g[1] - v) / 4 : i === 240 ? v - (v - g[239]) / 4 : v)); return { x, y: x.map(law.pdf) }; })();
    series.push({ id: 'pdf', kind: 'pdf', tone: 'signal', label: 'Density $f(x)$', x: curve.x, y: curve.y });
    const top = h.counts.indexOf(Math.max(...h.counts));
    modeObserved = r6(lo + (top + 0.5) * h.w);
    medTheory = law.median;
    if (h.outside) extraNote = `${h.outside} of ${n} draws fall outside the fixed display range $[${lo}, ${hi}]$; the readouts use all of them.`;
    medConvention = '$F(x) = \\tfrac12$';
  }
  // Bounded laws (beta on [0, 1], gamma from 0) keep only the rules inside their support, so the chart stays on it.
  const inRange = (x) => law.discrete || (x >= law.range[0] && x <= law.range[1]);
  series.push({ id: 'sigma-rules', kind: 'rule', tone: 'muted', label: '$M\\xi \\pm \\sigma,\\ 2\\sigma,\\ 3\\sigma$', x: [-3, -2, -1, 1, 2, 3].map((k) => law.mean + k * sd).filter(inRange), y: [] });
  series.push({ id: 'mean', kind: 'rule', tone: 'accent', label: '$M\\xi$', x: [law.mean], y: [] });

  const within = (k) => xs.reduce((c, x) => (Math.abs(x - law.mean) < k * sd ? c + 1 : c), 0) / n;
  const readouts = [
    { key: 'mean', label: 'Expectation $M\\xi$', observed: r6(sm.mean), theory: r6(law.mean), convention: 'sample mean $\\bar{x}$' },
    { key: 'variance', label: 'Variance $D\\xi$', observed: r6(sm.s2), theory: r6(law.variance), convention: '$s^2$, divisor $n - 1$' },
    { key: 'sd', label: 'Standard deviation $\\sigma$', observed: r6(Math.sqrt(sm.s2)), theory: r6(sd) },
    { key: 'median', label: 'Median', observed: r6(sampleMedian(sorted)), theory: r6(medTheory), convention: medConvention },
    { key: 'mode', label: 'Mode', observed: modeObserved, theory: modeText(law.mode), convention: law.discrete ? 'most frequent sample value' : `centre of the tallest of ${law.bins} histogram bins` },
    { key: 'skew', label: 'Skewness $Sk = \\mu_3/\\sigma^3$', observed: r6(sm.skew), theory: r6(law.skew), convention: '$m_3/m_2^{3/2}$, central moments with divisor $n$' },
    { key: 'exkurt', label: 'Excess kurtosis $Ek = \\mu_4/\\sigma^4 - 3$', observed: r6(sm.exkurt), theory: r6(law.exkurt), convention: '$m_4/m_2^2 - 3$, divisor $n$' },
  ];
  for (const k of [1, 2, 3, 4])
    readouts.push({ key: `rule${k}`, label: `$P(|\\xi - M\\xi| < ${k}\\sigma)$`, observed: r6(within(k)), theory: r6(sigmaRule(law, k)), convention: 'sample share; theory exact' });

  const notes = [
    `${law.name}: $M\\xi$, $D\\xi$, $Sk$ and $Ek$ are the closed forms of L6; the sample uses $n = ${n}$, seed ${seed}.`,
    'The $3\\sigma$ rule (formula (40)): for the normal law $P(|\\xi - a| < 3\\sigma) = 1 - 2\\Phi(-3) = 0.9973$. Both tails count: $2 \\cdot 0.00135 = 0.0027$ (L6 writes "$1 - 0.00135$").',
  ];
  if (li === 5) notes.push('L6 Table 3 prints 0.9997 for $4\\sigma$; the exact value is 0.99994. Its "% outside" column (32 %, 5 %, 0.7 %, 0.07 %) should read 31.7 %, 4.6 %, 0.27 %, 0.006 %.');
  if (li !== 5) notes.push('The $3\\sigma$ rule is a property of the normal law. For this law the exact share inside $3\\sigma$ is shown in the table and may differ from 0.9973.');
  if (extraNote) notes.push(extraNote);
  if (law.discrete) notes.push('For a discrete law the bars are sample frequencies at each value $k$, the stems are $P(\\xi = k)$.');
  if (li >= 6) notes.push('Shape lab: type the two parameters and watch the density bend; $Sk$ measures the lean of the tail, $Ek$ how heavy the tails are against the normal law ($Ek = 0$).');
  // The live formula: the closed forms of this law with the current numbers in them.
  const formula = law.formula ?? [
    `M\\xi = ${r6(law.mean)} \\qquad D\\xi = ${r6(law.variance)} \\qquad Sk = ${r6(law.skew)} \\qquad Ek = ${r6(law.exkurt)}`,
  ];
  return { axes: { x: 'value $x$', y: law.discrete ? 'probability' : 'density $f(x)$' }, readouts, series, notes, formula };
}

// ---------------------------------------------------------------- Balance (L6: the expectation as a centre of mass, #132)

export const BEAM = { lo: -5, hi: 5, weights: 4 };
const balanceParams = [
  ...[[-3, 0.2], [-1, 0.3], [1.5, 0.4], [4, 0.1]].flatMap(([x, w], i) => [
    { key: `x${i + 1}`, label: `Value $x_${i + 1}$`, min: BEAM.lo, max: BEAM.hi, step: 0.1, default: x },
    { key: `p${i + 1}`, label: `Probability $p_${i + 1}$`, min: 0, max: 1, step: 0.01, default: w },
  ]),
  { key: 'n', label: 'Throws $n$', min: 20, max: 20000, step: 10, default: 2000 },
];

/** The discrete law of the beam: values and probabilities as typed; weights that do not sum to 1 are rescaled. */
export function beamLaw(params) {
  const x = [], w = [];
  for (let i = 1; i <= BEAM.weights; i++) { x.push(params[`x${i}`]); w.push(params[`p${i}`]); }
  const total = w.reduce((a, b) => a + b, 0);
  const p = total > 0 ? w.map((v) => v / total) : w.map(() => 1 / BEAM.weights);
  const mean = x.reduce((a, v, i) => a + v * p[i], 0);
  const variance = x.reduce((a, v, i) => a + (v - mean) ** 2 * p[i], 0);
  return { x, p, total, mean, variance };
}

const texNum = (v) => { const t = String(r6(v)); return v < 0 ? `(${t})` : t; };

function runBalance(params, seed) {
  const { n } = params;
  const law = beamLaw(params);
  const cum = [];
  law.p.reduce((a, v, i) => (cum[i] = a + v), 0);
  const counts = law.x.map(() => 0);
  let sum = 0, sum2 = 0;
  for (let i = 0; i < n; i++) {
    const u = uni(seed, 100, i);
    let k = cum.findIndex((c) => u < c);
    if (k < 0) k = law.p.findLastIndex((v) => v > 0);
    counts[k]++;
    sum += law.x[k]; sum2 += law.x[k] ** 2;
  }
  const xbar = sum / n, s2 = n > 1 ? (sum2 - n * xbar * xbar) / (n - 1) : 0;
  const torque = law.x.reduce((a, v, i) => a + (v - law.mean) * law.p[i], 0);
  const order = law.x.map((_, i) => i);
  const series = [
    // One bar per weight (ids stable, so the bars glide as values are typed or dragged).
    { id: 'freq', kind: 'pmf', label: 'Sample frequency $n_i/n$', x: order.map((i) => law.x[i]), y: order.map((i) => r6(counts[i] / n)) },
    { id: 'pmf', kind: 'points', tone: 'signal', label: 'Probability $p_i$', x: law.x, y: law.p.map(r6) },
    { id: 'mean', kind: 'rule', tone: 'accent', label: 'Fulcrum $M\\xi = \\sum x_i p_i$', x: [r6(law.mean)], y: [] },
    { id: 'xbar', kind: 'rule', tone: 'muted', label: 'Sample mean $\\bar{x}$', x: [r6(xbar)], y: [] },
  ];
  const terms = law.x.map((v, i) => `${texNum(v)} \\cdot ${r6(law.p[i])}`).join(' + ');
  const formula = [
    `M\\xi = \\sum_{i=1}^{4} x_i\\,p_i = ${terms} = ${r6(law.mean)}`,
    `\\sum_{i=1}^{4} (x_i - M\\xi)\\,p_i = ${r6(Math.abs(torque) < 1e-12 ? 0 : torque)} \\qquad D\\xi = \\sum_{i=1}^{4} (x_i - M\\xi)^2\\,p_i = ${r6(law.variance)}`,
  ];
  const rescaled = Math.abs(law.total - 1) > 1e-9;
  const readouts = [
    { key: 'mean', label: 'Fulcrum: expectation $M\\xi$', observed: r6(xbar), theory: r6(law.mean), convention: 'observed: the sample mean $\\bar{x}$ of the throws' },
    { key: 'variance', label: 'Variance $D\\xi$', observed: r6(s2), theory: r6(law.variance), convention: '$s^2$, divisor $n - 1$' },
    { key: 'torque', label: 'Torque about the fulcrum $\\sum (x_i - M\\xi)\\,p_i$', observed: r6(law.x.reduce((a, v, i) => a + (v - xbar) * (counts[i] / n), 0)), theory: 0, convention: 'zero: the beam balances' },
    { key: 'total', label: 'Sum of the typed $p_i$', observed: r6(law.total), theory: 1, convention: rescaled ? 'not 1: each $p_i$ is divided by the sum' : 'the probabilities add up to 1' },
  ];
  const notes = [
    'L6: the expectation $M\\xi = \\sum x_i p_i$ is the centre of mass of the masses $p_i$ placed at the points $x_i$; the beam balances on it.',
    'Type a value or drag a weight: the fulcrum slides to the new $M\\xi$. A heavy weight far from the centre pulls it the most, since it enters as $x_i p_i$.',
    `The throws are a sample of $n = ${n}$; their mean $\\bar{x}$ is the centre of mass of the sample and settles at $M\\xi$ as $n$ grows.`,
  ];
  if (rescaled) notes.push(`The typed $p_i$ add up to ${r6(law.total)}, not 1; the beam uses $p_i / \\sum p_j$ so that they form a law.`);
  const beam = { x: law.x.map(r6), p: law.p.map(r6), mean: r6(law.mean), sampleMean: r6(xbar), range: [BEAM.lo, BEAM.hi], keys: law.x.map((_, i) => `x${i + 1}`), step: 0.1 };
  return { axes: { x: 'value $x$', y: 'probability' }, readouts, series, notes, formula, beam };
}

// ---------------------------------------------------------------- Transform (L6 §Functions of a random variable)

const transformParams = [
  { key: 'phi', label: 'Function (0 $\\alpha x + b$ · 1 $e^{x}$ · 2 $e^{-\\beta x}$ · 3 $x^2,\\ x \\ge 0$)', min: 0, max: 3, step: 1, default: 2 },
  { key: 'alpha', label: 'Slope $\\alpha$ (function 0)', min: -3, max: 3, step: 0.5, default: 2 },
  { key: 'b', label: 'Shift $b$ (function 0)', min: -2, max: 2, step: 0.5, default: 1 },
  { key: 'beta', label: 'Exponent $\\beta$ (function 2)', min: 0.25, max: 4, step: 0.25, default: 1 },
  { key: 'lambda', label: 'Rate $\\lambda$ of $\\xi \\sim \\mathrm{Exp}(\\lambda)$ (functions 2, 3)', min: 0.2, max: 4, step: 0.1, default: 2 },
  { key: 'sigma', label: '$\\sigma$ of $\\xi \\sim N(0, \\sigma)$ (functions 0, 1)', min: 0.2, max: 1.5, step: 0.1, default: 0.5 },
  { key: 'n', label: 'Sample size $n$', min: 100, max: 20000, step: 100, default: 5000 },
];

/** η = φ(ξ) for strictly monotone φ: density by formula (44), f_η(y) = f_ξ(φ⁻¹(y)) · |dφ⁻¹/dy|. */
export function makeTransform({ phi, alpha, b, beta, lambda, sigma }) {
  if (phi === 0) {
    if (alpha === 0) throw new Error('$\\alpha = 0$ makes $\\eta$ constant: formula (44) needs a strictly monotone $\\varphi$.');
    const s = Math.abs(alpha) * sigma;
    return {
      name: `$\\eta = ${alpha}\\xi ${b < 0 ? '-' : '+'} ${Math.abs(b)}$, $\\xi \\sim N(0, ${sigma})$`, source: 'normal',
      map: (x) => alpha * x + b, range: [-8, 8],
      pdf: (y) => normPdf((y - b) / alpha / sigma) / sigma / Math.abs(alpha),
      cdf: (y) => Phi((y - b) / s), mean: b,
    };
  }
  if (phi === 1)
    return {
      name: `$\\eta = e^{\\xi}$, $\\xi \\sim N(0, ${sigma})$`, source: 'normal', map: Math.exp, range: [0, 6],
      pdf: (y) => (y <= 0 ? 0 : normPdf(Math.log(y) / sigma) / (sigma * y)), cdf: (y) => (y <= 0 ? 0 : Phi(Math.log(y) / sigma)),
      mean: Math.exp((sigma * sigma) / 2),
    };
  if (phi === 2) {
    const g = lambda / beta;
    return {
      name: `$\\eta = e^{-${beta}\\xi}$, $\\xi \\sim \\mathrm{Exp}(${lambda})$`, source: 'exponential', map: (x) => Math.exp(-beta * x), range: [0, 1],
      pdf: (y) => (y <= 0 || y > 1 ? 0 : g * y ** (g - 1)), cdf: (y) => (y <= 0 ? 0 : y >= 1 ? 1 : y ** g),
      mean: lambda / (lambda + beta), unboundedAtZero: g < 1,
    };
  }
  return {
    name: `$\\eta = \\xi^2$, $\\xi \\sim \\mathrm{Exp}(${lambda})$ (monotone on $\\xi \\ge 0$)`, source: 'exponential', map: (x) => x * x, range: [0, 6],
    pdf: (y) => (y <= 0 ? 0 : (lambda * Math.exp(-lambda * Math.sqrt(y))) / (2 * Math.sqrt(y))),
    cdf: (y) => (y <= 0 ? 0 : 1 - Math.exp(-lambda * Math.sqrt(y))), mean: 2 / lambda ** 2, unboundedAtZero: true,
  };
}

function runTransform(params, seed) {
  if (params.phi === 0 && params.alpha === 0) {
    // Degenerate case the slider passes through: η = b with probability 1, so η has no density.
    return {
      axes: { x: 'value $y$ of $\\eta$', y: 'probability' },
      readouts: [{ key: 'mean', label: '$M\\eta$', observed: params.b, theory: params.b, convention: '$\\eta = b$ with probability 1' }],
      series: [{ id: 'atom', kind: 'pmf', tone: 'signal', label: '$P(\\eta = b) = 1$', x: [params.b], y: [1] }],
      notes: ['$\\alpha = 0$ makes $\\eta = b$ a constant: $\\varphi$ is not strictly monotone, so formula (44) does not apply and $\\eta$ has no density. Move $\\alpha$ away from 0.'],
    };
  }
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
    { key: 'mean', label: '$M\\eta$', observed: r6(sm.mean), theory: r6(t.mean), convention: 'sample mean' },
    { key: 'ks', label: 'Kolmogorov distance $\\sup_y |F_n(y) - F(y)|$', observed: r6(D), theory: r6(1.358 / Math.sqrt(n)), convention: 'theory column: 95 % critical value $1.358/\\sqrt{n}$' },
    { key: 'bins', label: 'Largest bin deviation, in standard errors', observed: r6(worst), theory: '$\\le 4.0$ in 99 % of runs', convention: 'max over $\\le 40$ bins with expected count $\\ge 5$ (Bonferroni); expected mass from $F$' },
    { key: 'mass', label: 'Share of $\\eta$ inside the shown range', observed: r6(1 - h.outside / n), theory: r6(t.cdf(hi) - t.cdf(lo)) },
  ];
  if (params.phi === 2) {
    const y0 = 0.5, g = params.lambda / params.beta;
    readouts.push({ key: 'F05', label: '$F(0.5) = 0.5^{\\lambda/\\beta}$ (L6 example)', observed: r6(ys.filter((y) => y < y0).length / n), theory: r6(y0 ** g), convention: 'share of $\\eta < 0.5$' });
  }
  const notes = [
    `${t.name}. The curve is formula (44): $f_\\eta(y) = f_\\xi\\bigl(\\varphi^{-1}(y)\\bigr) \\cdot \\left|\\dfrac{d\\varphi^{-1}(y)}{dy}\\right|$, valid for strictly monotone $\\varphi$.`,
    'The dots are the expected bin heights $\\dfrac{F(b) - F(a)}{\\text{width}}$, so the comparison stays exact where the density is unbounded.',
  ];
  if (params.phi === 2) notes.push(`L6 example: $\\eta = e^{-\\beta\\xi}$, $\\xi \\sim \\mathrm{Exp}(\\lambda)$ gives $F(y) = y^{\\lambda/\\beta}$ on $[0, 1]$; here $\\lambda/\\beta = ${r6(params.lambda / params.beta)}$.`);
  if (t.unboundedAtZero) notes.push(`$f_\\eta(y) \\to \\infty$ as $y \\to 0$; the drawn curve is cut at ${r6(cap)}.`);
  if (params.phi === 3) notes.push('$x^2$ is not monotone on $\\mathbb{R}$; it is monotone on the support $x \\ge 0$ of $\\mathrm{Exp}(\\lambda)$, so (44) applies with one branch.');
  return {
    axes: { x: 'value $y$ of $\\eta$', y: 'density' }, readouts, notes,
    series: [
      { id: 'hist', kind: 'hist', label: 'Histogram of $\\eta = \\varphi(\\xi)$', x: h.x, y: h.y },
      { id: 'pdf', kind: 'pdf', tone: 'signal', label: '$f_\\eta(y)$, formula (44)', x: xg, y: fy },
      { id: 'expected', kind: 'points', tone: 'signal', label: 'Expected bin height', x: h.x.map((a) => a + h.w / 2), y: expected },
    ],
  };
}

// ---------------------------------------------------------------- Scatter (L6 §Random vectors, correlation, regression, lottery)

const scatterParams = [
  { key: 'mode', label: 'Experiment (0 bivariate normal · 1 uniform disc · 2 matching problem · 3 parabola $\\eta = \\xi^2$ · 4 ring)', min: 0, max: 4, step: 1, default: 0 },
  { key: 'rho', label: 'Correlation $\\rho$ (experiment 0)', min: -1, max: 1, step: 0.05, default: 0.6 },
  { key: 'sigma1', label: '$\\sigma_X$ of $\\xi$ (experiment 0)', min: 0.5, max: 2, step: 0.1, default: 1 },
  { key: 'sigma2', label: '$\\sigma_Y$ of $\\eta$ (experiment 0)', min: 0.5, max: 2, step: 0.1, default: 1 },
  { key: 'n', label: 'Points $n$ (experiments 0, 1, 3, 4)', min: 200, max: 20000, step: 100, default: 2000 },
  { key: 'players', label: 'Players $n$ (experiment 2)', min: 2, max: 40, step: 1, default: 6 },
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
    // Nearest-node cells: the outer ring is half a cell wide, the corners a quarter.
    zSample: counts.map((row, j) => row.map((c, i) => r6(c / (xs.length * dx * dy * (i === 0 || i === N - 1 ? 0.5 : 1) * (j === 0 || j === N - 1 ? 0.5 : 1))))),
  };
}

/**
 * Degenerate case |ρ| = 1: η = ±(σ_Y/σ_X)ξ exactly, so all probability lies on one line and there is no density
 * in the plane. The ridge spreads the line's density over one grid cell across it, so its volume is still 1.
 */
function ridgeGrid(xs, ys, [x0, x1], [y0, y1], N, slope, s1) {
  const gx = grid(x0, x1, N), gy = grid(y0, y1, N), dy = gy[1] - gy[0];
  const out = surfaceGrid(xs, ys, [x0, x1], [y0, y1], N, () => 0, { x: '$\\xi$', y: '$\\eta$', z: 'density along the line' });
  out.z = gy.map((y) => gx.map((x) => {
    // The line's density per unit length of x, shared by the cell rows it crosses within this column.
    const on = Math.abs(y - slope * x) <= dy / 2 + 1e-12;
    return on ? r6(Math.exp(-(x * x) / (2 * s1 * s1)) / (Math.sqrt(2 * Math.PI) * s1 * dy)) : 0;
  }));
  return out;
}

function runVector({ mode, rho, sigma1 = 1, sigma2, n }, seed) {
  const xs = new Array(n), ys = new Array(n);
  const s1 = sigma1, degenerate = mode === 0 && Math.abs(rho) === 1;
  if (mode === 0) {
    const c = Math.sqrt(Math.max(0, 1 - rho * rho));
    for (let i = 0; i < n; i++) {
      const z1 = gauss(seed, 80, i), z2 = gauss(seed, 82, i);
      xs[i] = s1 * z1; ys[i] = sigma2 * (rho * z1 + c * z2);
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
  const band = degenerate ? [rho, rho] : [Math.tanh(zr - half), Math.tanh(zr + half)];
  const X = mode === 0 ? 3.5 * s1 : 1.1, Y = mode === 0 ? 3.5 * sigma2 : 1.1;
  const xl = grid(-X, X, 2), yl = grid(-Y, Y, 2);
  const series = [
    { id: 'points', kind: 'points', label: `Sample (first ${Math.min(n, SHOWN_POINTS)} of ${n})`, x: xs.slice(0, SHOWN_POINTS).map(r6), y: ys.slice(0, SHOWN_POINTS).map(r6) },
  ];
  // Line (63): y = r σ₂/σ₁ (x − Mξ) + Mη. Line (64): x = r σ₁/σ₂ (y − Mη) + Mξ, drawn as points (x(y), y).
  const yOnX = (k, mx, my) => ({ x: xl, y: xl.map((x) => my + k * (x - mx)) });
  const xOnY = (k, mx, my) => ({ x: yl.map((y) => mx + k * (y - my)), y: yl });
  const thY = yOnX(mode === 0 ? (rho * sigma2) / s1 : 0, 0, 0);
  series.push({ id: 'reg-yx-theory', kind: 'line', tone: 'signal', label: 'Line (63), theory: $y = \\rho\\,\\dfrac{\\sigma_Y}{\\sigma_X}\\,x$', ...thY });
  if (mode === 0 && rho !== 0) series.push({ id: 'reg-xy-theory', kind: 'line', tone: 'signal', label: 'Line (64), theory: $\\xi$ on $\\eta$', ...xOnY((rho * s1) / sigma2, 0, 0) });
  else series.push({ id: 'reg-xy-theory-rule', kind: 'rule', tone: 'signal', label: 'Line (64), theory: $x = M\\xi$ (vertical, $r = 0$)', x: [0], y: [] });
  series.push({ id: 'reg-yx', kind: 'line', tone: 'accent', label: 'Line (63) from the sample', ...yOnX(st.slopeYonX, st.mx, st.my) });
  series.push({ id: 'reg-xy', kind: 'line', tone: 'accent', label: 'Line (64) from the sample', ...xOnY(st.slopeXonY, st.mx, st.my) });

  let readouts, notes, surface, inside;
  if (mode === 0) {
    // Ellipse of dispersion Q(x, y) = c² with c = 2: P(inside) = 1 − e^(−c²/2) for a bivariate normal.
    const t = grid(0, 2 * Math.PI, 121), c = 2, L = Math.sqrt(Math.max(0, 1 - rho * rho));
    series.push({ id: 'ellipse', kind: 'line', tone: 'muted', label: degenerate ? 'Ellipse of dispersion, $c = 2$: flattened to a segment' : 'Ellipse of dispersion, $c = 2$', x: t.map((a) => s1 * c * Math.cos(a)), y: t.map((a) => sigma2 * c * (rho * Math.cos(a) + L * Math.sin(a))) });
    const slope = (rho * sigma2) / s1;
    if (degenerate) {
      // Every point lies on the line, inside the flattened ellipse exactly when |ξ| < c·σ_X: P = 2Φ(2) − 1.
      inside = xs.reduce((k, x) => (Math.abs(x) < c * s1 ? k + 1 : k), 0) / n;
      surface = ridgeGrid(xs, ys, [-X, X], [-Y, Y], 31, slope, s1);
      surface.title = `$\\rho = ${rho}$: no density in the plane, all probability on the line $y = ${rho < 0 ? '-' : ''}\\dfrac{\\sigma_Y}{\\sigma_X}\\,x$`;
    } else {
      const u = (x) => x / s1, v = (y) => y / sigma2;
      const Q = (x, y) => (u(x) ** 2 - 2 * rho * u(x) * v(y) + v(y) ** 2) / (1 - rho * rho);
      inside = xs.reduce((k, x, i) => (Q(x, ys[i]) < c * c ? k + 1 : k), 0) / n;
      const dens = (x, y) => Math.exp(-Q(x, y) / 2) / (2 * Math.PI * s1 * sigma2 * L);
      surface = surfaceGrid(xs, ys, [-X, X], [-Y, Y], 31, dens, { x: '$\\xi$', y: '$\\eta$', z: 'density $f(x, y)$' });
      surface.title = `Joint density of $(\\xi, \\eta)$, $\\rho = ${rho}$`;
    }
    surface.sampleLabel = 'Sample 2D histogram (the points so far)';
    const b = st.my - st.slopeYonX * st.mx, signed = (v) => (v < 0 ? `- ${r6(-v)}` : `+ ${r6(v)}`);
    readouts = [
      { key: 'r', label: 'Correlation: sample $r$ against $\\rho$', observed: r6(st.r), theory: rho, convention: degenerate ? 'with $|\\rho| = 1$ every sample has $r = \\rho$ exactly' : `99 % band ${r6(band[0])} … ${r6(band[1])} (Fisher $z$)` },
      { key: 'line', label: 'Regression line (63): $y = \\rho\\,\\dfrac{\\sigma_Y}{\\sigma_X}\\,x$', observed: `$y = ${r6(st.slopeYonX)}\\,x ${signed(b)}$`, theory: `$y = ${r6(slope)}\\,x$`, convention: 'sample: $y = r\\,\\dfrac{s_Y}{s_X}\\,(x - \\bar{x}) + \\bar{y}$' },
      { key: 'cov', label: '$\\operatorname{Cov}(\\xi, \\eta) = \\rho\\,\\sigma_X\\sigma_Y$', observed: r6(st.cov), theory: r6(rho * s1 * sigma2), convention: 'divisor $n - 1$' },
      { key: 'slope63', label: 'Slope of (63): $r\\,\\sigma_Y/\\sigma_X$', observed: r6(st.slopeYonX), theory: r6(slope) },
      { key: 'slope64', label: 'Slope of (64) as $dx/dy$: $r\\,\\sigma_X/\\sigma_Y$', observed: r6(st.slopeXonY), theory: r6((rho * s1) / sigma2) },
      { key: 'angle', label: 'Acute angle between (63) and (64)', observed: r6(regressionAngle(st.r, st.sx, st.sy)), theory: r6(regressionAngle(rho, s1, sigma2)), unit: '°' },
      { key: 'ellipse', label: 'Share inside the $c = 2$ ellipse', observed: r6(inside), theory: r6(degenerate ? 0.954499736104 : 1 - Math.exp(-2)), convention: degenerate ? 'the ellipse is a segment: $P(|\\xi| < 2\\sigma_X) = 2\\Phi(2) - 1$' : undefined },
    ];
    notes = [
      ...(degenerate ? [`$|\\rho| = 1$: $\\eta = ${rho < 0 ? '-' : ''}\\dfrac{\\sigma_Y}{\\sigma_X}\\,\\xi$ exactly, so every point lies on one line. The joint law has no density in the plane (the formula divides by $1 - \\rho^2 = 0$); the surface collapses to a ridge along the line, and both regression lines coincide with it.`] : []),
      'Lines (63) and (64) differ unless $|r| = 1$; the angle between them shrinks as $|r|$ grows and is $90^\\circ$ at $r = 0$.',
      'The 3D view puts the theoretical density $f(x, y)$ and the sample\'s 2D histogram on the same grid; the stems grow as points arrive.',
      'L6 leaves the least-squares check as an exercise; the sample lines here are the least-squares fits, and they coincide with (63)–(64) built from sample moments.',
    ];
  } else {
    let ex2 = 0, ey2 = 0;
    for (let i = 0; i < n; i++) { ex2 += xs[i] ** 2; ey2 += ys[i] ** 2; }
    const sq = vectorStats(xs.map((x) => x * x), ys.map((y) => y * y));
    const a = 0.75, tail = (2 / Math.PI) * (Math.acos(a) - a * Math.sqrt(1 - a * a));
    const both = xs.reduce((k, x, i) => (Math.abs(x) > a && Math.abs(ys[i]) > a ? k + 1 : k), 0) / n;
    const t = grid(0, 2 * Math.PI, 121);
    series.push({ id: 'disc', kind: 'line', tone: 'muted', label: 'Disc $x^2 + y^2 = 1$', x: t.map(Math.cos), y: t.map(Math.sin) });
    surface = surfaceGrid(xs, ys, [-X, X], [-Y, Y], 31, (x, y) => (x * x + y * y <= 1 ? 1 / Math.PI : 0), { x: '$\\xi$', y: '$\\eta$', z: 'density $f(x, y)$' });
    surface.title = 'Uniform density on the unit disc';
    readouts = [
      { key: 'cov', label: '$\\operatorname{Cov}(\\xi, \\eta)$', observed: r6(st.cov), theory: 0, convention: 'divisor $n - 1$' },
      { key: 'r', label: 'Correlation $r(\\xi, \\eta)$', observed: r6(st.r), theory: 0, convention: `99 % band ${r6(band[0])} … ${r6(band[1])}` },
      { key: 'r2', label: 'Correlation of $\\xi^2$ and $\\eta^2$', observed: r6(sq.r), theory: r6(-1 / 3), convention: 'nonzero: $\\xi$ and $\\eta$ are dependent' },
      { key: 'joint', label: '$P(|\\xi| > 0.75,\\ |\\eta| > 0.75)$', observed: r6(both), theory: 0, convention: 'the corner lies outside the disc' },
      { key: 'product', label: '$P(|\\xi| > 0.75) \\cdot P(|\\eta| > 0.75)$', observed: r6((xs.filter((x) => Math.abs(x) > a).length / n) * (ys.filter((y) => Math.abs(y) > a).length / n)), theory: r6(tail * tail), convention: 'what independence would require' },
    ];
    notes = [
      'L6: for the uniform disc $\\operatorname{Cov}(\\xi, \\eta) = 0$, yet $\\xi$ and $\\eta$ are dependent: $|\\xi|$ close to 1 forces $\\eta$ close to 0.',
      'The joint probability of the corners is 0, while the product of the marginals is not: the definition of independence fails.',
      `Mean of $\\xi^2$ is ${r6(ex2 / n)} (theory $\\tfrac14$), of $\\eta^2$ ${r6(ey2 / n)} (theory $\\tfrac14$).`,
    ];
  }
  return { axes: { x: '$x$ (value of $\\xi$)', y: '$y$ (value of $\\eta$)' }, readouts, series, notes, surface };
}

// #133: nonlinear dependence that the correlation coefficient does not see.
/** Parabola: ξ uniform on [−A, A], η = ξ² + Sε. Cov(ξ, ξ²) = Mξ³ = 0, so ρ = 0 while η is almost a function of ξ. */
export const PARABOLA = { A: 2, S: 0.2 };
/** Ring: angle uniform, radius 1 + Sε. Symmetric under x ↦ −x, so ρ = 0, yet ξ² + η² ≈ 1. */
export const RING = { S: 0.08 };
/** Exact correlation of ξ² and η (parabola) or of ξ² and η² (ring): the dependence that r(ξ, η) misses. */
export function nonlinearDependence(mode) {
  if (mode === 3) {
    const { A, S } = PARABOLA, v = (4 * A ** 4) / 45; // Var ξ² for ξ ~ U(−A, A): A⁴/5 − A⁴/9
    return Math.sqrt(v / (v + S * S));
  }
  // ξ² = R²cos²θ, η² = R²sin²θ with Var cos²θ = 1/8: corr = (m₄ − 2m₂²)/(3m₄ − 2m₂²), mₖ = MRᵏ.
  const s2 = RING.S ** 2, m2 = 1 + s2, m4 = 1 + 6 * s2 + 3 * s2 * s2;
  return (m4 - 2 * m2 * m2) / (3 * m4 - 2 * m2 * m2);
}

function runNonlinear({ mode, n }, seed) {
  const xs = new Array(n), ys = new Array(n), parabola = mode === 3;
  for (let i = 0; i < n; i++) {
    if (parabola) {
      const x = PARABOLA.A * (2 * uni(seed, 94, i) - 1);
      xs[i] = x; ys[i] = x * x + PARABOLA.S * gauss(seed, 95, i);
    } else {
      const r = 1 + RING.S * gauss(seed, 96, i), th = 2 * Math.PI * uni(seed, 97, i);
      xs[i] = r * Math.cos(th); ys[i] = r * Math.sin(th);
    }
  }
  const st = vectorStats(xs, ys);
  const sq = parabola ? vectorStats(xs.map((x) => x * x), ys) : vectorStats(xs.map((x) => x * x), ys.map((y) => y * y));
  const half = Z99 / Math.sqrt(n - 3), band = [Math.tanh(-half), Math.tanh(half)];
  const { A, S } = PARABOLA;
  const [x0, x1] = parabola ? [-1.1 * A, 1.1 * A] : [-1.4, 1.4];
  const [y0, y1] = parabola ? [-0.8, A * A + 0.8] : [-1.4, 1.4];
  const my = parabola ? (A * A) / 3 : 0; // Mη: Mξ² = A²/3 for the parabola, 0 for the ring
  const xl = grid(x0, x1, 2), yl = grid(y0, y1, 2);
  const t = grid(0, 1, 121);
  const series = [
    { id: 'points', kind: 'points', label: `Sample (first ${Math.min(n, SHOWN_POINTS)} of ${n})`, x: xs.slice(0, SHOWN_POINTS).map(r6), y: ys.slice(0, SHOWN_POINTS).map(r6) },
    parabola
      ? { id: 'curve', kind: 'line', tone: 'muted', label: 'The dependence: $y = x^2$', x: t.map((u) => r6(-A + 2 * A * u)), y: t.map((u) => r6((-A + 2 * A * u) ** 2)) }
      : { id: 'curve', kind: 'line', tone: 'muted', label: 'The dependence: $x^2 + y^2 = 1$', x: t.map((u) => r6(Math.cos(2 * Math.PI * u))), y: t.map((u) => r6(Math.sin(2 * Math.PI * u))) },
    { id: 'reg-yx-theory', kind: 'line', tone: 'signal', label: 'Line (63), theory: $y = M\\eta$ (flat, $\\rho = 0$)', x: xl, y: xl.map(() => r6(my)) },
    { id: 'reg-xy-theory-rule', kind: 'rule', tone: 'signal', label: 'Line (64), theory: $x = M\\xi$ (vertical, $r = 0$)', x: [0], y: [] },
    { id: 'reg-yx', kind: 'line', tone: 'accent', label: 'Line (63) from the sample', x: xl, y: xl.map((x) => r6(st.my + st.slopeYonX * (x - st.mx))) },
    { id: 'reg-xy', kind: 'line', tone: 'accent', label: 'Line (64) from the sample', x: yl.map((y) => r6(st.mx + st.slopeXonY * (y - st.my))), y: yl },
  ];
  const npdf = (z) => normPdf(z);
  const density = parabola
    ? (x, y) => (Math.abs(x) <= A ? (npdf((y - x * x) / S) / S) / (2 * A) : 0)
    : (x, y) => { const r = Math.hypot(x, y); return r === 0 ? 0 : npdf((r - 1) / RING.S) / RING.S / (2 * Math.PI * r); };
  const surface = surfaceGrid(xs, ys, [x0, x1], [y0, y1], 31, density, { x: '$\\xi$', y: '$\\eta$', z: 'density $f(x, y)$' });
  surface.title = parabola ? 'Joint density of $(\\xi, \\eta)$: a ridge along $y = x^2$' : 'Joint density of $(\\xi, \\eta)$: a ring around $x^2 + y^2 = 1$';
  surface.sampleLabel = 'Sample 2D histogram (the points so far)';
  const dep = nonlinearDependence(mode);
  const readouts = [
    { key: 'r', label: 'Correlation: sample $r$ against $\\rho$', observed: r6(st.r), theory: 0, convention: `99 % band ${r6(band[0])} … ${r6(band[1])} (Fisher $z$)` },
    { key: 'cov', label: '$\\operatorname{Cov}(\\xi, \\eta)$', observed: r6(st.cov), theory: 0, convention: parabola ? '$M\\xi^3 = 0$ for a symmetric $\\xi$' : 'symmetric under $x \\mapsto -x$' },
    parabola
      ? { key: 'dep', label: 'Correlation of $\\xi^2$ and $\\eta$', observed: r6(sq.r), theory: r6(dep), convention: 'close to 1: $\\eta$ is almost a function of $\\xi$' }
      : { key: 'dep', label: 'Correlation of $\\xi^2$ and $\\eta^2$', observed: r6(sq.r), theory: r6(dep), convention: 'close to $-1$: $\\xi^2 + \\eta^2 \\approx 1$' },
    { key: 'slope63', label: 'Slope of (63): $r\\,\\sigma_Y/\\sigma_X$', observed: r6(st.slopeYonX), theory: 0 },
  ];
  const notes = parabola
    ? [
      `$\\eta = \\xi^2 + ${S}\\,\\varepsilon$ with $\\xi$ uniform on $[-${A}, ${A}]$: knowing $\\xi$ fixes $\\eta$ almost exactly, yet $\\rho = 0$ because $\\operatorname{Cov}(\\xi, \\xi^2) = M\\xi^3 = 0$.`,
      'The correlation coefficient measures only linear dependence: the best line through the parabola is flat, so $r \\approx 0$ while the points lie on a curve.',
      'Uncorrelated does not mean independent (L6); the correlation of $\\xi^2$ with $\\eta$ is close to 1 and shows the dependence.',
    ]
    : [
      `A ring of radius $1 + ${RING.S}\\,\\varepsilon$ at a uniform angle: the cloud is symmetric, so $\\rho = 0$ and both regression lines are flat or vertical.`,
      'Yet $\\xi$ and $\\eta$ are strongly dependent: $|\\xi|$ close to 1 forces $\\eta$ close to 0, and $\\xi^2 + \\eta^2 \\approx 1$.',
      'Uncorrelated does not mean independent (L6); the correlation of $\\xi^2$ and $\\eta^2$ is close to $-1$.',
    ];
  return { axes: { x: '$x$ (value of $\\xi$)', y: '$y$ (value of $\\eta$)' }, readouts, series, notes, surface };
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
    axes: { x: 'number of matches $k$', y: 'probability' },
    readouts: [
      { key: 'mean', label: 'Mean number of prizes $M\\mu$', observed: r6(sm.mean), theory: 1, convention: `band $\\pm ${r6(bands.mean)}$` },
      { key: 'variance', label: 'Variance $D\\mu$', observed: r6(sm.s2), theory: 1, convention: `$s^2$, divisor $K - 1$; band $\\pm ${r6(bands.variance)}$` },
      { key: 'p0', label: '$P(\\text{no prize})$', observed: r6(counts[0] / reps), theory: r6(pmf[0]), convention: `$\\to 1/e = ${r6(Math.exp(-1))}$` },
      { key: 'draws', label: 'Lottery draws $K$', observed: reps, theory: null },
    ],
    series: [
      { id: 'freq', kind: 'hist', label: 'Share of draws with $k$ matches', x: shown.map((k) => k - 0.5), y: shown.map((k) => counts[k] / reps) },
      { id: 'pmf', kind: 'pmf', tone: 'signal', label: 'Exact $P(\\mu = k)$', x: shown, y: shown.map((k) => pmf[k]) },
      { id: 'poisson', kind: 'points', tone: 'muted', label: '$\\mathrm{Poisson}(1)$ limit', x: shown, y: poisson },
    ],
    notes: [
      `L6 lottery: $\\mu = \\sum_k \\mu_k$, $M\\mu_k = 1/n$, so $M\\mu = 1$ for every $n$; with $\\operatorname{Cov}(\\mu_i, \\mu_j) = \\dfrac{1}{n^2(n-1)}$ the variance is also 1 ($n = ${n}$, ${reps} seeded shuffles).`,
      'L6 then adds "$M + D = 1 + 1 = 2$ prizes". Mean plus variance mixes units; the usual allowance is $M + \\sigma = 1 + 1 = 2$, which gives the same number only because $D = \\sigma = 1$.',
    ],
  };
}

// ---------------------------------------------------------------- contract

export const meta = {
  id: 'lecture-random-vectors',
  lectures: ['L5', 'L6'],
  title: 'Moments, the $3\\sigma$ rule, functions of a random variable, correlation and regression',
  params: momentsParams,
};

export const stations = {
  moments: { params: momentsParams, live: true },
  transform: { params: transformParams, live: true },
  scatter: { params: scatterParams, live: true },
  balance: { params: balanceParams, live: true },
};

export function run(params, { seed, station = 'moments' } = {}) {
  const s = seed >>> 0;
  if (station === 'transform') return runTransform(params, s);
  if (station === 'balance') return runBalance(params, s);
  if (station === 'scatter') return params.mode === 2 ? runMatching(params, s) : params.mode >= 3 ? runNonlinear(params, s) : runVector(params, s);
  return runMoments(params, s);
}

export { LAW_NAMES };
