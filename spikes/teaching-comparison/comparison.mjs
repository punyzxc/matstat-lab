// Discovery fixture only (#19). Not product code. Self-contained on purpose: it repeats the
// #14 fixture mixer and the #13 inversion sampler so this folder runs on its own.
export const FIXTURE_VERSION = 'teaching-comparison-fixture-v1';
export const MODEL = Object.freeze({ family: 'exponential', rate: 1, mean: 1, variance: 1, skewness: 2 });
export const SIZES = Object.freeze({ small: 10, large: 100 });
// Shared edges for both runs: 0 to 7 in steps of 0.5. F(7) = 1 - e^-7, so 0.09% of the mass is overflow.
export const EDGES = Object.freeze(Array.from({ length: 15 }, (_, i) => i / 2));
// Stream ids. Independent design: replicate r draws its small sample from stream 1 + 2r and its
// large sample from stream 2 + 2r. Nested design: replicate r uses stream 2^20 + r for both, and the
// small sample is the first 10 draws of the large one. The single run is replicate 0.
export const streamOf = (design, size, replicate = 0) => (design === 'nested' ? 2 ** 20 + replicate : (size === 'small' ? 1 : 2) + 2 * replicate);

function mix32(x) {
  x = Math.imul(x ^ x >>> 16, 0x7feb352d);
  x = Math.imul(x ^ x >>> 15, 0x846ca68b);
  return (x ^ x >>> 16) >>> 0;
}
// Same addressing as spikes/simulation-engine fixtureUint32 (namespace 0x7eac for this lesson).
export const NAMESPACE = 0x7eac;
export const uint32 = (seed, stream, index) => mix32(seed ^ mix32(stream + 0x9e3779b9) ^ mix32(index + 0x85ebca6b) ^ NAMESPACE);
export const uniform = (seed, stream, index) => (uint32(seed, stream, index) + 0.5) / 2 ** 32;
// Inversion, one uniform per draw (#13): -log1p(-u) below 1/2, -log(1-u) above (1-u is exact there).
export const exponential = (u) => (u <= 0.5 ? -Math.log1p(-u) : -Math.log(1 - u)) / MODEL.rate;
export const draws = (seed, stream, n) => Array.from({ length: n }, (_, i) => exponential(uniform(seed, stream, i)));

export function sample(seed, design, size, replicate = 0) {
  return draws(seed, streamOf(design, size, replicate), SIZES[size]);
}

const cdf = (x) => (x <= 0 ? 0 : -Math.expm1(-MODEL.rate * x));
export function metrics(xs) {
  const n = xs.length;
  let mean = 0; let m2 = 0;
  xs.forEach((x, i) => { const d = x - mean; mean += d / (i + 1); m2 += d * (x - mean); });
  const sorted = [...xs].sort((a, b) => a - b);
  // Kolmogorov distance between the right-continuous ECDF and the model CDF.
  let ks = 0;
  sorted.forEach((x, i) => { const F = cdf(x); ks = Math.max(ks, (i + 1) / n - F, F - i / n); });
  const counts = new Array(EDGES.length - 1).fill(0); let overflow = 0;
  for (const x of xs) {
    if (x > EDGES[EDGES.length - 1]) { overflow++; continue; }
    let b = EDGES.length - 2; while (b > 0 && x < EDGES[b]) b--; counts[b]++;
  }
  return {
    n, mean, absError: Math.abs(mean - MODEL.mean), sd: n > 1 ? Math.sqrt(m2 / (n - 1)) : null,
    ks, counts, overflow, max: sorted[n - 1],
  };
}

// Expected estimator error of the sample mean for Exponential(1), exact.
// RMSE = sigma / sqrt(n). Mean absolute error: xbar ~ Gamma(n, rate n), E|xbar - 1| = 2 n^n e^-n / n!.
export function expectedError(n) {
  let logFact = 0; for (let k = 2; k <= n; k++) logFact += Math.log(k);
  return { rmse: Math.sqrt(MODEL.variance / n), meanAbsError: 2 * Math.exp(n * Math.log(n) - n - logFact) };
}

export function compare(seed, design, replicate = 0) {
  const small = metrics(sample(seed, design, 'small', replicate));
  const large = metrics(sample(seed, design, 'large', replicate));
  return { seed, design, small, large, largerIsCloser: large.absError < small.absError };
}

// How often a single run is a counterexample (larger n, larger error), over seeds 1..R.
export function counterexampleRate(design, R) {
  let k = 0;
  for (let seed = 1; seed <= R; seed++) if (!compare(seed, design).largerIsCloser) k++;
  const p = k / R;
  return { R, counterexamples: k, rate: p, monteCarloSE: Math.sqrt(p * (1 - p) / R) };
}

// Phase 2 of the lesson: R replicates of both sample sizes under one seed. The class's single run
// is replicate 0, so it reappears as one point among R.
export function repeated(seed, design, R) {
  const out = {};
  for (const size of ['small', 'large']) {
    const means = [];
    for (let r = 0; r < R; r++) means.push(metrics(sample(seed, design, size, r)).mean);
    const mse = means.reduce((a, m) => a + (m - MODEL.mean) ** 2, 0) / R;
    const mae = means.reduce((a, m) => a + Math.abs(m - MODEL.mean), 0) / R;
    out[size] = { n: SIZES[size], R, rmse: Math.sqrt(mse), meanAbsError: mae, expected: expectedError(SIZES[size]) };
  }
  let worse = 0;
  for (let r = 0; r < R; r++) if (!compare(seed, design, r).largerIsCloser) worse++;
  out.counterexampleShare = worse / R;
  return out;
}
// For independent, centred normal errors A and B: P(|A| > |B|) = (2/pi) atan(sd_A / sd_B).
export const normalApproxCounterexample = () => (2 / Math.PI) * Math.atan(Math.sqrt(SIZES.small / SIZES.large));
