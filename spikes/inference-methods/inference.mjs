// Throwaway Discovery spike for issue #15. Not product code.
// Estimator oracles, z and t intervals for Normal data, and a coverage check
// with a predeclared exact binomial acceptance band.

// ---------- seeded randomness (spike only; the engine owns the real PRNG) ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normalSampler(rand) {
  let spare = null;
  return () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0;
    while (u === 0) u = rand();
    const r = Math.sqrt(-2 * Math.log(u)), th = 2 * Math.PI * rand();
    spare = r * Math.sin(th);
    return r * Math.cos(th);
  };
}

// ---------- estimators ----------
export const mean = x => x.reduce((s, v) => s + v, 0) / x.length;
export function sumSquares(x) {
  const m = mean(x);
  return x.reduce((s, v) => s + (v - m) ** 2, 0);
}
/** divisor 'n' (plug-in, defined for n >= 1) or 'n-1' (unbiased, n >= 2). */
export function variance(x, divisor) {
  const n = x.length;
  if (divisor === 'n') return n >= 1 ? sumSquares(x) / n : NaN;
  if (divisor === 'n-1') return n >= 2 ? sumSquares(x) / (n - 1) : NaN;
  throw new RangeError('divisor must be n or n-1');
}

/**
 * Exact sampling oracles for i.i.d. data with variance sigma2 and excess
 * kurtosis kappa (0 for Normal). Returns bias, variance and MSE of each estimator.
 * Var(s^2) = sigma^4 (2/(n-1) + kappa/n)  (holds for any law with finite 4th moment).
 */
export function oracles(n, sigma2, kappa = 0) {
  const s4 = sigma2 ** 2;
  const varS2 = s4 * (2 / (n - 1) + kappa / n);
  const c = (n - 1) / n; // plug-in = c * s^2
  const mse = (bias, v) => ({ bias, variance: v, mse: v + bias ** 2 });
  return {
    mean: mse(0, sigma2 / n),
    'var-n-1': n >= 2 ? mse(0, varS2) : null,
    'var-n': n >= 2 ? mse(-sigma2 / n, c * c * varS2) : null,
  };
}

// ---------- quantiles ----------
// Acklam's rational approximation, refined by one Halley step on the lower tail.
// Accuracy is limited by how precisely p itself is stored: near p = 1, 1 - p keeps
// only about 1e-16 / (1 - p) relative precision.
export function normalQuantile(p) {
  if (!(p > 0 && p < 1)) throw new RangeError('p must be in (0, 1)');
  if (p > 0.5) return -normalQuantile(1 - p);
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5, r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return x - u / (1 + x * u / 2);
}
export function normalCdf(x) { return 0.5 * erfc(-x / Math.SQRT2); }
function erfc(x) { // Taylor series for erf near 0, Lentz continued fraction in the tails
  const z = Math.abs(x);
  if (z < 2) { // series for erf; for larger |x|, 1 - erf would lose digits to cancellation
    let sum = z, term = z, n = 0;
    do { n++; term *= -z * z / n; sum += term / (2 * n + 1); } while (Math.abs(term / (2 * n + 1)) > 1e-17 * Math.abs(sum));
    const erf = 2 / Math.sqrt(Math.PI) * sum;
    return x >= 0 ? 1 - erf : 1 + erf;
  }
  // continued fraction for large |x| (Lentz)
  let f = z, C = z, D = 0;
  for (let i = 1; i < 300; i++) {
    const an = i / 2;
    D = z + an * D; D = 1 / D;
    C = z + an / C;
    const delta = C * D; f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  const r = Math.exp(-z * z) / Math.sqrt(Math.PI) / f;
  return x >= 0 ? r : 2 - r;
}

function logGamma(x) { // Lanczos, g = 7
  const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = g[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += g[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function betacf(a, b, x) { // continued fraction for the incomplete beta (Numerical Recipes 6.4)
  const tiny = 1e-300;
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}
function regIncBeta(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export function studentTCdf(t, df) {
  const ib = regIncBeta(df / 2, 0.5, df / (df + t * t));
  return t >= 0 ? 1 - ib / 2 : ib / 2;
}
// Upper tail P(T > t) for t >= 0, computed directly to avoid 1 - cdf cancellation.
const tUpper = (t, df) => regIncBeta(df / 2, 0.5, df / (df + t * t)) / 2;
export function studentTQuantile(p, df) {
  if (!(p > 0 && p < 1)) throw new RangeError('p must be in (0, 1)');
  if (!(Number.isInteger(df) && df >= 1)) throw new RangeError('df must be a positive integer');
  if (p === 0.5) return 0;
  if (p < 0.5) return -studentTQuantile(1 - p, df);
  const tail = 1 - p;
  let lo = 0, hi = 1;
  while (tUpper(hi, df) > tail) { lo = hi; hi *= 2; if (!Number.isFinite(hi)) return Infinity; }
  // Bisection on the bracket until it is as narrow as doubles allow.
  for (let i = 0; i < 2000 && hi - lo > 4 * Number.EPSILON * hi; i++) {
    const mid = (lo + hi) / 2;
    if (tUpper(mid, df) > tail) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------- intervals with typed applicability ----------
const fail = (code, detail) => ({ ok: false, code, detail });
function common(x, level) {
  if (!(level > 0 && level < 1)) return fail('level-out-of-range', 'confidence level must be in (0, 1)');
  if (!Array.isArray(x) || x.length === 0) return fail('n-too-small', 'needs at least one observation');
  if (!x.every(Number.isFinite)) return fail('non-finite-data', 'all observations must be finite');
  return null;
}
/** Known-sigma z interval for the mean of i.i.d. Normal data. Valid for n >= 1. */
export function zInterval(x, { sigma, level = 0.95 } = {}) {
  const bad = common(x, level);
  if (bad) return bad;
  if (!(Number.isFinite(sigma) && sigma > 0)) return fail('sigma-not-positive', 'known sigma must be finite and > 0');
  const n = x.length, m = mean(x), q = normalQuantile(1 - (1 - level) / 2), half = q * sigma / Math.sqrt(n);
  if (![m - half, m + half].every(Number.isFinite)) return fail('non-finite-result', 'the interval overflowed double precision');
  return { ok: true, method: 'z-known-sigma', n, estimate: m, lower: m - half, upper: m + half, critical: q, assumptions: ['iid', 'normal-or-large-n', 'sigma-known'] };
}
/** Unknown-sigma Student t interval for the mean of i.i.d. Normal data. Valid for n >= 2. */
export function tInterval(x, { level = 0.95 } = {}) {
  const bad = common(x, level);
  if (bad) return bad;
  const n = x.length;
  if (n < 2) return fail('n-too-small', 't interval needs n >= 2 to estimate sigma');
  const s = Math.sqrt(variance(x, 'n-1'));
  if (!Number.isFinite(s)) return fail('non-finite-result', 'the sample variance overflowed double precision');
  if (s === 0) return fail('zero-sample-variance', 'all observations are equal; the t interval degenerates');
  const m = mean(x), q = studentTQuantile(1 - (1 - level) / 2, n - 1), half = q * s / Math.sqrt(n);
  if (![m - half, m + half].every(Number.isFinite)) return fail('non-finite-result', 'the interval overflowed double precision');
  return { ok: true, method: 't-unknown-sigma', n, estimate: m, lower: m - half, upper: m + half, critical: q, df: n - 1, assumptions: ['iid', 'normal'] };
}

// ---------- coverage check ----------
function logChoose(n, k) { return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1); }
export function binomialPmf(k, n, p) { return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p)); }
/**
 * Exact acceptance region [lo, hi] for the number of covering intervals out of R
 * when the true coverage equals the nominal level: each tail has probability <= alpha/2.
 */
export function acceptanceBand(R, nominal, alpha = 0.001) {
  let lo = 0, tail = 0;
  while (tail + binomialPmf(lo, R, nominal) <= alpha / 2) tail += binomialPmf(lo++, R, nominal);
  let hi = R; tail = 0;
  while (tail + binomialPmf(hi, R, nominal) <= alpha / 2) tail += binomialPmf(hi--, R, nominal);
  return { lo, hi, alpha };
}

/** draw(rand) -> one observation; returns hits out of R and the Monte Carlo standard error. */
export function coverage({ method, n, R, seed, level = 0.95, mu, sigma, draw }) {
  if (!(Number.isSafeInteger(R) && R > 0)) return fail('invalid-repetitions', 'R must be a positive integer');
  const rand = mulberry32(seed);
  const sample = draw(rand);
  let hits = 0, failures = 0;
  for (let r = 0; r < R; r++) {
    const x = Array.from({ length: n }, sample);
    const ci = method === 'z' ? zInterval(x, { sigma, level }) : tInterval(x, { level });
    if (!ci.ok) { failures++; continue; }
    if (ci.lower <= mu && mu <= ci.upper) hits++;
  }
  const valid = R - failures;
  if (valid === 0) return { ...fail('no-valid-replicates', 'the method was not applicable to any replicate'), failures };
  const phat = hits / valid;
  return { ok: true, hits, valid, failures, coverage: phat, mcse: Math.sqrt(phat * (1 - phat) / valid) };
}

// ---------- later: exact sign test (documented path, minimal reference) ----------
/** Two-sided exact sign test for H0: median = m0, continuous law; ties with m0 are dropped. */
export function signTest(x, m0) {
  if (!Number.isFinite(m0) || !x.every(Number.isFinite)) return { ok: false, code: 'non-finite-data' };
  const above = x.filter(v => v > m0).length, below = x.filter(v => v < m0).length;
  const n = above + below;
  if (n === 0) return { ok: false, code: 'all-ties' };
  const k = Math.min(above, below);
  // Exact integer arithmetic: P(S <= k) = sum C(n, i) / 2^n.
  let c = 1n, sum = 0n;
  for (let i = 0; i <= k; i++) { sum += c; c = c * BigInt(n - i) / BigInt(i + 1); }
  const pValue = Math.min(1, Number(2n * sum * 1000000000000000000n / (1n << BigInt(n))) / 1e18);
  return { ok: true, n, above, ties: x.length - n, pValue };
}
