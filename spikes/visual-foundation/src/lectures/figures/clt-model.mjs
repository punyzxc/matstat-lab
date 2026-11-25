// The normal distribution factory (#111): the numbers behind the L8 lecture figure.
// Uniform and exponential terms reuse the CLT kernel's laws and streams (spikes/lecture-limit-theorems),
// so a figure and the CLT station with the same seed and n produce the same standardized sums.
// Pure module: no DOM. Randomness only from fixtureUint32.
import { LAWS, kolmogorovDistance, standardizedSums } from '../../../../lecture-limit-theorems/kernel.mjs';
import { fixtureUint32 } from '../../../../simulation-engine/engine.mjs';

const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;
/** The stream of term t, exactly as in the kernel's standardizedSums. */
export const termStream = (t) => 500 + 2 * t * 7919;

const kernelLaw = (id) => LAWS.find((l) => l.id === id);
const UNIFORM = kernelLaw('uniform'), EXPONENTIAL = kernelLaw('exponential');

/**
 * The sources a term can come from. `p` is the Bernoulli success probability (ignored by the others).
 * `station` is the CLT station's `law` parameter for the same law, or null when the station has no such law.
 */
export const SOURCES = Object.freeze([
  { id: 'uniform', label: 'U(0,\\,1)', tex: () => 'U(0,\\,1)', station: 0, discrete: false,
    mean: () => UNIFORM.mean, sd: () => UNIFORM.sd, draw: (seed, t, r) => UNIFORM.draw(seed, termStream(t), r),
    domain: () => [-0.15, 1.15], density: (x) => (x >= 0 && x <= 1 ? 1 : 0) },
  { id: 'exponential', label: '\\operatorname{Exp}(1)', tex: () => '\\operatorname{Exp}(1)', station: 1, discrete: false,
    mean: () => EXPONENTIAL.mean, sd: () => EXPONENTIAL.sd, draw: (seed, t, r) => EXPONENTIAL.draw(seed, termStream(t), r),
    domain: () => [-0.3, 5], density: (x) => (x >= 0 ? Math.exp(-x) : 0) },
  { id: 'bernoulli', label: '\\operatorname{Bern}(p)', tex: (p) => `\\operatorname{Bern}(${p})`, station: null, discrete: true,
    mean: (p) => p, sd: (p) => Math.sqrt(p * (1 - p)), draw: (seed, t, r, p) => (uni(seed, termStream(t) + 31, r) < p ? 1 : 0),
    domain: () => [-0.4, 1.4], atoms: (p) => [[0, 1 - p], [1, p]] },
]);
export const sourceOf = (i) => SOURCES[Math.min(SOURCES.length - 1, Math.max(0, Math.round(i) || 0))];

/** One replicate r: its first `keep` terms, the sum S_n and the standardized z = (S_n − n·a)/(σ√n). */
export function replicate(src, n, seed, r, p = 0.3, keep = 40) {
  const terms = [];
  let s = 0;
  for (let t = 0; t < n; t++) {
    const x = src.draw(seed, t, r, p);
    s += x;
    if (t < keep) terms.push(x);
  }
  return { terms, sum: s, z: (s - n * src.mean(p)) / (src.sd(p) * Math.sqrt(n)) };
}

/** R standardized sums. Uniform and exponential come straight from the kernel. */
export function zSample(src, n, R, seed, p = 0.3) {
  if (src.id !== 'bernoulli') return standardizedSums(src.id === 'uniform' ? UNIFORM : EXPONENTIAL, n, R, seed);
  const out = new Float64Array(R);
  for (let r = 0; r < R; r++) out[r] = replicate(src, n, seed, r, p, 0).z;
  return out;
}

/** Standard normal CDF Φ (Zelen–Severo / erf series, |error| < 1e-7). */
export function Phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const q = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - q : q;
}
export const phi = (z) => 0.3989422804014327 * Math.exp(-z * z / 2);

/** Kolmogorov distance sup |F_R(z) − Φ(z)| of the first `count` values. */
export const ksToNormal = (values, count = values.length) => (count > 0 ? kolmogorovDistance(values.subarray(0, count), Phi) : null);

/** Histogram of the first `count` values over [lo, hi) in `bins` equal bins: counts and densities. */
export function zHistogram(values, count, bins = 40, lo = -4, hi = 4) {
  const counts = new Array(bins).fill(0), w = (hi - lo) / bins;
  for (let i = 0; i < count; i++) {
    const k = Math.floor((values[i] - lo) / w);
    if (k >= 0 && k < bins) counts[k]++;
  }
  return { counts, width: w, density: counts.map((c) => (count ? c / (count * w) : 0)) };
}
