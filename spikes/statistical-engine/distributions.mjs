// Discovery fixture only (#13). Not product code: crew-guard keeps spikes/ out of the build.
// One self-contained reference implementation of the six distribution contracts, used to
// measure how close plain Float64 JavaScript gets to the SciPy oracle in reference.json.

export const SPIKE_VERSION = 'statistical-engine-spike-v1';

export class DistributionError extends Error {
  constructor(code, message) { super(message); this.name = 'DistributionError'; this.code = code; }
}
const fail = (code, message) => { throw new DistributionError(code, message); };
const finite = (x, name) => { if (typeof x !== 'number' || !Number.isFinite(x)) fail('INVALID_PARAMETER', `${name} must be a finite number`); return x; };
const probability = (p) => { finite(p, 'p'); if (p < 0 || p > 1) fail('INVALID_PARAMETER', 'p must be in [0, 1]'); return p; };
const count = (n) => { if (!Number.isSafeInteger(n) || n < 0) fail('INVALID_PARAMETER', 'n must be a non-negative safe integer'); return n; };
const openUniform = (u) => { if (!(u > 0 && u < 1)) fail('INVALID_UNIFORM', 'u must be in the open interval (0, 1)'); return u; };

// ---------- special functions ----------
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
const LOG_FACTORIAL = [0];
for (let k = 1, acc = 1; k <= 170; k++) { acc *= k; LOG_FACTORIAL.push(Math.log(acc)); }
export function lgamma(x) {
  if (Number.isInteger(x) && x >= 1 && x <= 171) return LOG_FACTORIAL[x - 1];
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Loader (2000) saddle-point pieces: stirlerr(n) = log(n!) - log(sqrt(2*pi*n)*(n/e)^n),
// bd0(x, m) = x*log(x/m) + m - x computed without cancellation.
const LOG_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);
export function stirlerr(n) {
  if (n > 15) {
    const nn = n * n;
    if (n > 500) return (1 / 12 - 1 / 360 / nn) / n;
    if (n > 80) return (1 / 12 - (1 / 360 - 1 / 1260 / nn) / nn) / n;
    if (n > 35) return (1 / 12 - (1 / 360 - (1 / 1260 - 1 / 1680 / nn) / nn) / nn) / n;
    return (1 / 12 - (1 / 360 - (1 / 1260 - (1 / 1680 - 1 / 1188 / nn) / nn) / nn) / nn) / n;
  }
  return lgamma(n + 1) - (n + 0.5) * Math.log(n) + n - LOG_SQRT_2PI;
}
export function bd0(x, m) {
  if (Math.abs(x - m) < 0.1 * (x + m)) {
    let v = (x - m) / (x + m); let s = (x - m) * v; let ej = 2 * x * v; v *= v;
    for (let j = 1; j < 1000; j++) { ej *= v; const s1 = s + ej / (2 * j + 1); if (s1 === s) return s1; s = s1; }
    return s;
  }
  return x * Math.log(x / m) + m - x;
}
// log of x^k e^-x / k! for real k > 0, x > 0 (Loader's dpois_raw).
export function logPoissonRaw(k, x) {
  return -stirlerr(k) - bd0(k, x) - 0.5 * Math.log(2 * Math.PI * k);
}
// log of C(n,k) p^k q^(n-k) for real 0 < k < n (Loader's dbinom_raw).
export function logBinomialRaw(k, n, p, q) {
  return stirlerr(n) - stirlerr(k) - stirlerr(n - k) - bd0(k, n * p) - bd0(n - k, n * q)
    + 0.5 * Math.log(n / (2 * Math.PI * k * (n - k)));
}

const EPS = 1e-16;
const TINY = 1e-300;
const MAX_ITER = 1_000_000;
// Regularized lower P(a, x) and upper Q(a, x) incomplete gamma (series / Lentz continued fraction).
export function gammaPQ(a, x) {
  if (x <= 0) return { P: 0, Q: 1 };
  // x^a e^-x / Gamma(a) = a * dpois_raw(a, x); Loader's form keeps relative accuracy for large a.
  const front = a * Math.exp(logPoissonRaw(a, x));
  if (x < a + 1) {
    let ap = a; let sum = 1 / a; let del = sum;
    for (let i = 0; i < MAX_ITER; i++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * EPS) break; }
    const P = sum * front;
    return { P, Q: 1 - P };
  }
  let b = x + 1 - a; let c = 1 / TINY; let d = 1 / b; let h = d;
  for (let i = 1; i < MAX_ITER; i++) {
    const an = -i * (i - a); b += 2;
    d = an * d + b; if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c; if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  const Q = front * h;
  return { P: 1 - Q, Q };
}

function betacf(a, b, x) {
  const qab = a + b; const qap = a + 1; const qam = a - 1;
  let c = 1; let d = 1 - qab * x / qap; if (Math.abs(d) < TINY) d = TINY; d = 1 / d; let h = d;
  for (let m = 1; m < MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY; c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY; d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
// Regularized incomplete beta I_x(a, b). y = 1 - x is passed separately so that
// callers holding both p and q never round-trip through 1 - (1 - p).
export function betaI(a, b, x, y = 1 - x) {
  if (x <= 0) return 0;
  if (y <= 0) return 1;
  // x^a (1-x)^b / B(a, b) = (a*b/(a+b)) * dbinom_raw(a; a+b, x, 1-x).
  const front = (a * b / (a + b)) * Math.exp(logBinomialRaw(a, a + b, x, y));
  if (x < (a + 1) / (a + b + 2)) return front * betacf(a, b, x) / a;
  return 1 - front * betacf(b, a, y) / b;
}

// erfc through the incomplete gamma identity erfc(z) = Q(1/2, z^2) for z >= 0.
export function erfc(z) {
  if (z === 0) return 1;
  // Beyond |z| = 40 erfc is 0 or 2 in double precision; z * z would overflow for huge z.
  if (Math.abs(z) > 40) return z > 0 ? 0 : 2;
  const q = gammaPQ(0.5, z * z);
  return z > 0 ? q.Q : 1 + q.P;
}

// Acklam's rational approximation, then one Halley step against the erfc-based CDF.
const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
export function standardNormalPpf(u) {
  let x;
  if (u < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(u));
    x = (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  } else if (u <= 1 - 0.02425) {
    const q = u - 0.5; const r = q * q;
    x = (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log1p(-u));
    x = -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1);
  }
  // Halley refinement; work in the tail that keeps the residual well conditioned.
  const e = x < 0 ? 0.5 * erfc(-x / Math.SQRT2) - u : (1 - u) - 0.5 * erfc(x / Math.SQRT2);
  const g = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return x - g / (1 + x * g / 2);
}

// Smallest integer k in [lo, hi] with cdf(k) >= u (the SciPy ppf convention).
function discretePpf(cdf, u, lo, hi, guess) {
  let k = Math.min(hi, Math.max(lo, Math.floor(guess)));
  if (cdf(k) >= u) { while (k > lo && cdf(k - 1) >= u) k--; return k; }
  while (k < hi && cdf(k) < u) k++;
  return k;
}

// ---------- the six models ----------
function normal({ mu, sigma }) {
  finite(mu, 'mu'); finite(sigma, 'sigma'); if (!(sigma > 0)) fail('INVALID_PARAMETER', 'sigma must be > 0');
  const z = (x) => (x - mu) / sigma;
  return {
    measure: 'pdf', support: { kind: 'real', lower: -Infinity, upper: Infinity },
    pdf: (x) => Math.exp(-0.5 * z(x) ** 2) / (sigma * Math.sqrt(2 * Math.PI)),
    logpdf: (x) => -0.5 * z(x) ** 2 - Math.log(sigma) - 0.5 * Math.log(2 * Math.PI),
    cdf: (x) => 0.5 * erfc(-z(x) / Math.SQRT2),
    sf: (x) => 0.5 * erfc(z(x) / Math.SQRT2),
    ppf: (u) => mu + sigma * standardNormalPpf(openUniform(u)),
    moments: { mean: mu, variance: sigma * sigma, skewness: 0, excessKurtosis: 0 },
  };
}
function uniform({ a, b }) {
  finite(a, 'a'); finite(b, 'b'); if (!(a < b)) fail('INVALID_PARAMETER', 'a must be < b');
  const width = b - a; if (!Number.isFinite(width)) fail('INVALID_PARAMETER', 'b - a must be finite');
  const clamp = (t) => Math.min(1, Math.max(0, t));
  return {
    measure: 'pdf', support: { kind: 'interval', lower: a, upper: b, closed: true },
    pdf: (x) => (x >= a && x <= b ? 1 / width : 0),
    logpdf: (x) => (x >= a && x <= b ? -Math.log(width) : -Infinity),
    cdf: (x) => clamp((x - a) / width),
    sf: (x) => clamp((b - x) / width),
    ppf: (u) => (openUniform(u) <= 0.5 ? a + width * u : b - width * (1 - u)),
    moments: { mean: a / 2 + b / 2, variance: width * width / 12, skewness: 0, excessKurtosis: -1.2 },
  };
}
function exponential({ rate }) {
  finite(rate, 'rate'); if (!(rate > 0)) fail('INVALID_PARAMETER', 'rate must be > 0');
  return {
    measure: 'pdf', support: { kind: 'interval', lower: 0, upper: Infinity, closed: true },
    pdf: (x) => (x < 0 ? 0 : rate * Math.exp(-rate * x)),
    logpdf: (x) => (x < 0 ? -Infinity : Math.log(rate) - rate * x),
    cdf: (x) => (x <= 0 ? 0 : -Math.expm1(-rate * x)),
    sf: (x) => (x <= 0 ? 1 : Math.exp(-rate * x)),
    // 1-u is exact for u > 1/2, so the upper tail keeps full precision.
    ppf: (u) => (openUniform(u) <= 0.5 ? -Math.log1p(-u) : -Math.log(1 - u)) / rate,
    moments: { mean: 1 / rate, variance: 1 / (rate * rate), skewness: 2, excessKurtosis: 6 },
  };
}
const discreteMoments = (mean, variance, skewness, excessKurtosis) => (variance === 0
  ? { mean, variance: 0, skewness: null, excessKurtosis: null, degenerate: true }
  : { mean, variance, skewness, excessKurtosis });
function binomialModel(n, p, kind) {
  const q = 1 - p;
  const isInt = (k) => Number.isInteger(k);
  const logpmf = (k) => {
    if (!isInt(k) || k < 0 || k > n) return -Infinity;
    if (p === 0) return k === 0 ? 0 : -Infinity;
    if (p === 1) return k === n ? 0 : -Infinity;
    if (k === 0) return n * Math.log1p(-p);
    if (k === n) return n * Math.log(p);
    return logBinomialRaw(k, n, p, q);
  };
  const cdf = (x) => {
    const k = Math.floor(x);
    if (k < 0) return 0; if (k >= n) return 1;
    if (p === 0) return 1; if (p === 1) return 0;
    return betaI(n - k, k + 1, q, p);
  };
  const sf = (x) => {
    const k = Math.floor(x);
    if (k < 0) return 1; if (k >= n) return 0;
    if (p === 0) return 0; if (p === 1) return 1;
    return betaI(k + 1, n - k, p, q);
  };
  const variance = n * p * q;
  return {
    measure: 'pmf', support: { kind: 'integers', lower: 0, upper: n }, kind,
    pmf: (k) => Math.exp(logpmf(k)), logpmf, cdf, sf,
    ppf: (u) => discretePpf(cdf, openUniform(u), 0, n, n * p + Math.sqrt(variance) * standardNormalPpf(u)),
    moments: discreteMoments(n * p, variance, (q - p) / Math.sqrt(variance), (1 - 6 * p * q) / variance),
  };
}
function poisson({ rate }) {
  finite(rate, 'rate'); if (rate < 0) fail('INVALID_PARAMETER', 'rate must be >= 0');
  const logpmf = (k) => {
    if (!Number.isInteger(k) || k < 0) return -Infinity;
    if (rate === 0) return k === 0 ? 0 : -Infinity;
    if (k === 0) return -rate;
    return logPoissonRaw(k, rate);
  };
  const cdf = (x) => { const k = Math.floor(x); if (k < 0) return 0; if (rate === 0) return 1; return gammaPQ(k + 1, rate).Q; };
  const sf = (x) => { const k = Math.floor(x); if (k < 0) return 1; if (rate === 0) return 0; return gammaPQ(k + 1, rate).P; };
  return {
    measure: 'pmf', support: { kind: 'integers', lower: 0, upper: Infinity },
    pmf: (k) => Math.exp(logpmf(k)), logpmf, cdf, sf,
    ppf: (u) => discretePpf(cdf, openUniform(u), 0, Number.MAX_SAFE_INTEGER, rate + Math.sqrt(rate) * standardNormalPpf(u)),
    moments: discreteMoments(rate, rate, 1 / Math.sqrt(rate), 1 / rate),
  };
}

export function create(family, params) {
  switch (family) {
    case 'normal': return normal(params);
    case 'uniform': return uniform(params);
    case 'exponential': return exponential(params);
    case 'bernoulli': return binomialModel(1, probability(params.p), 'bernoulli');
    case 'binomial': return binomialModel(count(params.n), probability(params.p), 'binomial');
    case 'poisson': return poisson(params);
    default: return fail('UNKNOWN_FAMILY', `unknown family ${family}`);
  }
}

// ---------- chart helpers (proposed conventions) ----------
// Half-open bins [e_i, e_{i+1}), last bin closed; out-of-range draws are counted, never dropped.
export function histogram(sample, edges) {
  const counts = new Array(edges.length - 1).fill(0);
  let underflow = 0; let overflow = 0;
  for (const x of sample) {
    if (x < edges[0]) { underflow++; continue; }
    if (x > edges[edges.length - 1]) { overflow++; continue; }
    let i = edges.length - 2;
    while (i > 0 && x < edges[i]) i--;
    counts[i]++;
  }
  const n = sample.length;
  const densityHeights = counts.map((c, i) => c / (n * (edges[i + 1] - edges[i])));
  return { edges, counts, underflow, overflow, densityHeights };
}
// Right-continuous ECDF on distinct sorted values.
export function ecdf(sample) {
  const sorted = [...sample].sort((a, b) => a - b);
  const x = []; const p = [];
  sorted.forEach((v, i) => {
    if (i + 1 < sorted.length && sorted[i + 1] === v) return;
    x.push(v); p.push((i + 1) / sorted.length);
  });
  return { x, p };
}
// Integer-centred edges so a discrete bar of unit width has density height = relative frequency.
export const integerEdges = (lo, hi) => Array.from({ length: hi - lo + 2 }, (_, i) => lo - 0.5 + i);
