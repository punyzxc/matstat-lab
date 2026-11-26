// Distribution Explorer (#91, L5–L6): draw a sample from a law, built in or typed (#88), and set its histogram and
// empirical CDF against the law's density (or masses) and CDF, with x̄ and s² beside MX and DX.
// The kernel touches no DOM and uses no Math.random: the same params and seed always give the same sample.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import { normalCdf, kolmogorovQuantile } from '../lecture-special-functions/special.mjs';
import { lawOf, checkLaw, DEFAULT_LAW, LAW_PRESETS, LAW_HINT } from '../custom-distributions/law.mjs';

const NAMESPACE = 0xd157;
const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i, NAMESPACE) + 0.5) / 2 ** 32;
const r6 = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(6)));
const d4 = (v) => String(Number(Number(v).toPrecision(4)));
const SQRT2PI = Math.sqrt(2 * Math.PI);
const logFact = (k) => { let s = 0; for (let j = 2; j <= k; j++) s += Math.log(j); return s; };

export const TYPED = 5;
const LAW_CHOICES = 'Law (0 normal, 1 uniform, 2 exponential, 3 binomial, 4 Poisson, 5 typed)';

/** A discrete law on given values with given masses: CDF, left limit and inverse CDF. */
function discrete(values, probs) {
  const cum = [];
  probs.reduce((acc, p, i) => (cum[i] = acc + p), 0);
  const find = (x, strict) => {
    let lo = 0, hi = values.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (strict ? values[m] < x : values[m] <= x) lo = m + 1; else hi = m; }
    return lo ? Math.min(1, cum[lo - 1]) : 0;
  };
  return {
    values, probs,
    cdf: Object.assign((x) => find(x, false), { left: (x) => find(x, true) }),
    quantile: (u) => {
      let lo = 0, hi = values.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] >= u) hi = m; else lo = m + 1; }
      return values[lo];
    },
  };
}

/**
 * The law chosen by the parameters: kind, moments, CDF, a sampler `draw(seed, i)` and its formula. Continuous laws
 * have `pdf`; discrete ones `values` and `probs` (the Poisson tail is cut where it falls below 10⁻¹²).
 */
export function lawFor(q) {
  switch (q.law) {
    case 0: {
      const { a, sigma: s } = q;
      return {
        kind: 'continuous', name: `normal law $N(${d4(a)},\\, ${d4(s)}^2)$`, mean: a, variance: s * s, range: [a - 4 * s, a + 4 * s],
        pdf: (x) => Math.exp(-0.5 * ((x - a) / s) ** 2) / (s * SQRT2PI), cdf: (x) => normalCdf((x - a) / s),
        draw: (seed, i) => a + s * Math.sqrt(-2 * Math.log(uni(seed, 1, i))) * Math.cos(2 * Math.PI * uni(seed, 2, i)),
        tex: `f(x) = \\dfrac{1}{\\sigma\\sqrt{2\\pi}}\\, e^{-\\frac{(x - a)^2}{2\\sigma^2}}, \\qquad a = ${d4(a)},\\; \\sigma = ${d4(s)}`,
      };
    }
    case 1: {
      const lo = Math.min(q.lo, q.hi), hi = Math.max(q.lo, q.hi);
      if (!(hi > lo)) throw new Error('The right end b must be larger than the left end a.');
      const w = hi - lo;
      return {
        kind: 'continuous', name: `uniform law $U(${d4(lo)},\\, ${d4(hi)})$`, mean: (lo + hi) / 2, variance: (w * w) / 12, range: [lo - 0.15 * w, hi + 0.15 * w],
        pdf: (x) => (x >= lo && x <= hi ? 1 / w : 0), cdf: (x) => Math.min(1, Math.max(0, (x - lo) / w)),
        draw: (seed, i) => lo + w * uni(seed, 1, i),
        tex: `f(x) = \\begin{cases} \\dfrac{1}{b - a}, & x \\in [a, b] \\\\ 0, & x \\notin [a, b] \\end{cases} \\qquad a = ${d4(lo)},\\; b = ${d4(hi)}`,
      };
    }
    case 2: {
      const l = q.lambda;
      return {
        kind: 'continuous', name: `exponential law, $\\lambda = ${d4(l)}$`, mean: 1 / l, variance: 1 / (l * l), range: [0, 6 / l],
        pdf: (x) => (x < 0 ? 0 : l * Math.exp(-l * x)), cdf: (x) => (x <= 0 ? 0 : -Math.expm1(-l * x)),
        draw: (seed, i) => -Math.log(uni(seed, 1, i)) / l,
        tex: `f(x) = \\begin{cases} \\lambda e^{-\\lambda x}, & x \\ge 0 \\\\ 0, & x < 0 \\end{cases} \\qquad \\lambda = ${d4(l)}`,
      };
    }
    case 3: {
      const { m, p } = q, k = Array.from({ length: m + 1 }, (_, j) => j);
      const probs = k.map((j) => Math.exp(logFact(m) - logFact(j) - logFact(m - j) + j * Math.log(p) + (m - j) * Math.log1p(-p)));
      const d = discrete(k, probs);
      return {
        kind: 'discrete', unit: true, name: `binomial law, $m = ${m}$, $p = ${d4(p)}$`, mean: m * p, variance: m * p * (1 - p), ...d,
        draw: (seed, i) => d.quantile(uni(seed, 1, i)),
        tex: `P(X = k) = C_m^k\\, p^k (1 - p)^{m - k}, \\quad k = 0, \\dots, m, \\qquad m = ${m},\\; p = ${d4(p)}`,
      };
    }
    case 4: {
      const l = q.lambda, probs = [];
      for (let j = 0, pj = Math.exp(-l); j < 400 && (j <= l || pj > 1e-12); j++, pj *= l / j) probs.push(pj);
      const d = discrete(probs.map((_, j) => j), probs);
      return {
        kind: 'discrete', unit: true, name: `Poisson law, $\\lambda = ${d4(l)}$`, mean: l, variance: l, ...d,
        draw: (seed, i) => d.quantile(uni(seed, 1, i)),
        tex: `P(X = k) = \\dfrac{\\lambda^k}{k!}\\, e^{-\\lambda}, \\quad k = 0, 1, 2, \\dots, \\qquad \\lambda = ${d4(l)}`,
      };
    }
    default: {
      const t = lawOf(q.custom ?? DEFAULT_LAW);
      const base = { name: 'typed law', mean: t.mean, variance: t.variance, tex: t.tex, draw: (seed, i) => t.quantile(uni(seed, 1, i)) };
      if (t.kind === 'continuous') {
        const pad = (t.hi - t.lo) * 0.08;
        return { ...base, kind: 'continuous', range: [t.lo - pad, t.hi + pad], pdf: t.pdf, cdf: t.cdf };
      }
      const unit = t.integer && t.values.every((v, j) => j === 0 || v - t.values[j - 1] === 1);
      return { ...base, kind: 'discrete', unit, values: t.values, probs: t.probs, cdf: Object.assign((x) => t.cdf(x), { left: t.cdfLeft }) };
    }
  }
}

/** sup |Fₙ(x) − F(x)|, with F(x−) on the lower side (it equals F(x) for a continuous law). */
export function kolmogorovDistance(sorted, F) {
  const n = sorted.length, left = F.left ?? F;
  let d = 0;
  for (let i = 0; i < n; i++) {
    if (i + 1 < n && sorted[i + 1] === sorted[i]) continue;
    let first = i;
    while (first > 0 && sorted[first - 1] === sorted[i]) first--;
    d = Math.max(d, (i + 1) / n - F(sorted[i]), left(sorted[i]) - first / n);
  }
  return d;
}

/** L10's rule of thumb for the number of intervals. */
export const binCount = (n) => Math.max(5, Math.round(5 * Math.log10(n)));

function run1(q, seed) {
  const L = lawFor(q);
  const n = q.n;
  const x = Array.from({ length: n }, (_, i) => L.draw(seed, i));
  const sorted = Float64Array.from(x).sort();
  let mean = 0;
  for (const v of x) mean += v;
  mean /= n;
  let ss = 0;
  for (const v of x) ss += (v - mean) ** 2;
  const s2 = n > 1 ? ss / (n - 1) : NaN;
  const D = kolmogorovDistance(sorted, L.cdf);
  const band = kolmogorovQuantile(0.999) / Math.sqrt(n);
  const series = [], linked = [];
  let lo, hi, k = null;
  if (L.kind === 'continuous') {
    lo = Math.min(L.range[0], sorted[0]);
    hi = Math.max(L.range[1], sorted[n - 1]);
    k = q.bins > 0 ? q.bins : binCount(n);
    const a = sorted[0], b = sorted[n - 1], h = (b - a) / k || 1;
    const counts = new Array(k).fill(0);
    for (const v of x) counts[Math.min(k - 1, Math.floor((v - a) / h))]++;
    const grid = Array.from({ length: 241 }, (_, i) => lo + ((hi - lo) * i) / 240);
    series.push(
      { id: 'hist', kind: 'hist', tone: 'default', label: `histogram, $k = ${k}$ intervals`, x: Array.from({ length: k }, (_, i) => r6(a + i * h)), y: counts.map((c) => r6(c / (n * h))) },
      { id: 'pdf', kind: 'pdf', tone: 'signal', label: `density $f(x)$ of the ${L.name}`, x: grid.map(r6), y: grid.map((v) => r6(L.pdf(v))) },
    );
    linked.push(
      { id: 'cdf', kind: 'cdf', tone: 'signal', label: '$F(x)$', x: grid.map(r6), y: grid.map((v) => r6(L.cdf(v))) },
      ecdfSeries(sorted),
    );
  } else {
    const counts = new Map();
    for (const v of x) counts.set(v, (counts.get(v) ?? 0) + 1);
    // Values worth drawing: those with visible mass, and any value that was drawn.
    const top = Math.max(...L.probs);
    const shown = L.values.filter((v, j) => L.probs[j] >= top * 1e-4 || counts.has(v));
    lo = shown[0] - (L.unit ? 1 : 0.5);
    hi = shown.at(-1) + (L.unit ? 1 : 0.5);
    const freq = shown.map((v) => r6((counts.get(v) ?? 0) / n));
    series.push(
      L.unit
        ? { id: 'hist', kind: 'hist', tone: 'default', label: 'relative frequencies $m_k/n$', x: shown.map((v) => v - 0.5), y: freq }
        : { id: 'hist', kind: 'pmf', tone: 'default', label: 'relative frequencies $m_k/n$', x: shown, y: freq },
      { id: 'pdf', kind: 'points', tone: 'signal', marker: 'dot', label: `masses $p_k$ of the ${L.name}`, x: shown, y: shown.map((v) => r6(L.probs[L.values.indexOf(v)])) },
    );
    linked.push(
      { id: 'cdf', kind: 'ecdf', tone: 'signal', label: '$F(x)$', x: shown, y: shown.map((v) => r6(L.cdf(v))) },
      ecdfSeries(sorted),
    );
  }
  const sd = Math.sqrt(L.variance);
  return {
    readouts: [
      { key: 'mean', label: 'Sample mean $\\bar{x}$ against $MX$', observed: r6(mean), theory: r6(L.mean), convention: `± ${d4(4 * sd / Math.sqrt(n))} (4 standard errors)` },
      { key: 'var', label: 'Sample variance $s^2$ against $DX$', observed: r6(s2), theory: r6(L.variance), convention: 'divisor $n - 1$: unbiased' },
      { key: 'sd', label: 'Standard deviation $s$ against $\\sigma = \\sqrt{DX}$', observed: r6(Math.sqrt(s2)), theory: r6(sd) },
      { key: 'ks', label: 'Kolmogorov distance $D_n = \\sup_x |F_n(x) - F(x)|$', observed: r6(D), theory: `below $${d4(band)}$ in 99.9% of samples`,
        convention: L.kind === 'discrete' ? 'for a discrete law the distance is smaller still' : `$\\lambda_{0.999}/\\sqrt{n}$, $n = ${n}$` },
      { key: 'range', label: 'Smallest and largest values', observed: `${d4(sorted[0])} … ${d4(sorted[n - 1])}`, theory: null },
    ],
    series,
    axes: { x: '$x$', y: L.kind === 'continuous' ? 'density' : 'probability' },
    domain: { x: [lo, hi] },
    linked: { series: linked, axes: { x: '$x$', y: 'distribution function' }, domain: { x: [lo, hi], y: [0, 1.04] } },
    formula: [
      L.tex,
      `\\bar{x} = \\dfrac{1}{n}\\sum_{i=1}^{n} x_i = ${d4(mean)} \\qquad MX = ${d4(L.mean)}`,
      `s^2 = \\dfrac{1}{n - 1}\\sum_{i=1}^{n} (x_i - \\bar{x})^2 = ${d4(s2)} \\qquad DX = ${d4(L.variance)}`,
    ],
    notes: [
      L.kind === 'continuous'
        ? `L5: the histogram (heights $m_r/(nh)$, total area 1) estimates the density $f(x)$; the empirical CDF $F_n(x) = \\#\\{x_i \\le x\\}/n$ (lower chart) estimates $F(x)$. Both come from the same $n = ${n}$ seeded draws.`
        : `L5: the share $m_k/n$ of each value estimates its mass $p_k$; the empirical CDF $F_n(x)$ (lower chart) climbs in the same steps as $F(x)$. Both come from the same $n = ${n}$ seeded draws.`,
      'L6: $\\bar{x}$ and $s^2$ estimate $MX$ and $DX$; their errors shrink like $1/\\sqrt{n}$. Type a larger $n$ to see the histogram settle on the law.',
      ...(L.kind === 'continuous' ? [`L10's rule of thumb gives $k \\approx 5 \\lg n = ${binCount(n)}$ intervals; type your own $k$ to see how the picture depends on it.`] : []),
    ],
  };
}
const ecdfSeries = (sorted) => {
  // One point per distinct value: Fₙ jumps there by (its count)/n.
  const xs = [], ys = [], n = sorted.length;
  for (let i = 0; i < n; i++) if (i + 1 === n || sorted[i + 1] !== sorted[i]) { xs.push(r6(sorted[i])); ys.push(r6((i + 1) / n)); }
  return { id: 'ecdf', kind: 'ecdf', tone: 'default', label: '$F_n(x)$, empirical', x: xs, y: ys };
};

const params = [
  { key: 'law', label: LAW_CHOICES, min: 0, max: 5, step: 1, default: 0 },
  { key: 'a', label: 'Mean $a$', min: -10, max: 10, step: 0.1, default: 0, when: { law: [0] } },
  { key: 'sigma', label: 'Standard deviation $\\sigma$', min: 0.1, max: 10, step: 0.1, default: 1, when: { law: [0] } },
  { key: 'lo', label: 'Left end $a$', min: -10, max: 10, step: 0.1, default: 0, when: { law: [1] } },
  { key: 'hi', label: 'Right end $b$', min: -10, max: 10, step: 0.1, default: 1, when: { law: [1] } },
  { key: 'lambda', label: 'Rate $\\lambda$', min: 0.1, max: 20, step: 0.1, default: 1, when: { law: [2, 4] } },
  { key: 'm', label: 'Trials $m$', min: 1, max: 100, step: 1, default: 10, when: { law: [3] } },
  { key: 'p', label: 'Success probability $p$', min: 0.01, max: 0.99, step: 0.01, default: 0.3, when: { law: [3] } },
  { key: 'n', label: 'Sample size $n$', min: 10, max: 20000, step: 1, default: 500 },
  { key: 'bins', label: 'Intervals $k$ ($0 = 5 \\lg n$)', min: 0, max: 60, step: 1, default: 0, when: { law: [0, 1, 2, 5] } },
];
export const meta = {
  id: 'lecture-distribution-explorer',
  lectures: ['L5', 'L6'],
  title: 'Distribution Explorer: a sample against its law, built in or typed',
  params,
};
export const stations = Object.freeze({
  distribution: {
    params, live: true,
    texts: [{ key: 'custom', label: 'Your law: values | probabilities, or a density on $[a, b]$', default: DEFAULT_LAW, presets: [...LAW_PRESETS], hint: LAW_HINT, when: { law: [TYPED] } }],
  },
});
export function checkText(station, key, value) {
  return station === 'distribution' && key === 'custom' ? checkLaw(value) : null;
}

export function run(params = {}, { seed = 1 } = {}) {
  const q = Object.fromEntries(params && typeof params === 'object' ? Object.entries(params) : []);
  for (const p of stations.distribution.params) if (!Number.isFinite(q[p.key])) q[p.key] = p.default;
  if (typeof params?.custom === 'string') q.custom = params.custom;
  if (!Number.isInteger(q.n) || q.n < 2) throw new Error('n must be a whole number of at least 2.');
  return run1(q, seed >>> 0);
}
export default { meta, stations, run, checkText };
