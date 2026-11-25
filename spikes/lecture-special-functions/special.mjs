// Discovery fixture only (#54). Not product code. One module of named special functions that every
// lecture kernel can import. Pure functions: no DOM, no randomness, no global state.
// The numerical core (Lanczos log-gamma, Loader's stirlerr/bd0, incomplete gamma and beta, erfc)
// is the one measured against SciPy and mpmath in the #13 research (docs/research/statistical-engine.md).

export const SPECIAL_VERSION = 'lecture-special-functions-spike-v1';

export class SpecialFunctionError extends Error {
  constructor(code, message) { super(message); this.name = 'SpecialFunctionError'; this.code = code; }
}
const fail = (code, message) => { throw new SpecialFunctionError(code, message); };
const real = (x, name) => { if (typeof x !== 'number' || Number.isNaN(x)) fail('INVALID_ARGUMENT', `${name} must be a number, got ${x}`); return x; };
const prob = (p) => { real(p, 'p'); if (!(p > 0 && p < 1)) fail('PROBABILITY_OUT_OF_RANGE', `p must be in (0, 1), got ${p}`); return p; };
const dof = (v, name = 'df') => { real(v, name); if (!(v > 0) || !Number.isFinite(v)) fail('INVALID_DF', `${name} must be a finite number > 0, got ${v}`); return v; };

// ---------- special functions ----------
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
const LOG_FACTORIAL = [0];
for (let k = 1, acc = 1; k <= 170; k++) { acc *= k; LOG_FACTORIAL.push(Math.log(acc)); }
function lgamma(x) {
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
function stirlerr(n) {
  if (n > 15) {
    const nn = n * n;
    if (n > 500) return (1 / 12 - 1 / 360 / nn) / n;
    if (n > 80) return (1 / 12 - (1 / 360 - 1 / 1260 / nn) / nn) / n;
    if (n > 35) return (1 / 12 - (1 / 360 - (1 / 1260 - 1 / 1680 / nn) / nn) / nn) / n;
    return (1 / 12 - (1 / 360 - (1 / 1260 - (1 / 1680 - 1 / 1188 / nn) / nn) / nn) / nn) / n;
  }
  return lgamma(n + 1) - (n + 0.5) * Math.log(n) + n - LOG_SQRT_2PI;
}
function bd0(x, m) {
  if (Math.abs(x - m) < 0.1 * (x + m)) {
    let v = (x - m) / (x + m); let s = (x - m) * v; let ej = 2 * x * v; v *= v;
    for (let j = 1; j < 1000; j++) { ej *= v; const s1 = s + ej / (2 * j + 1); if (s1 === s) return s1; s = s1; }
    return s;
  }
  return x * Math.log(x / m) + m - x;
}
// log of x^k e^-x / k! for real k > 0, x > 0 (Loader's dpois_raw).
function logPoissonRaw(k, x) {
  return -stirlerr(k) - bd0(k, x) - 0.5 * Math.log(2 * Math.PI * k);
}
// log of C(n,k) p^k q^(n-k) for real 0 < k < n (Loader's dbinom_raw).
function logBinomialRaw(k, n, p, q) {
  return stirlerr(n) - stirlerr(k) - stirlerr(n - k) - bd0(k, n * p) - bd0(n - k, n * q)
    + 0.5 * Math.log(n / (2 * Math.PI * k * (n - k)));
}

const EPS = 1e-16;
const TINY = 1e-300;
const MAX_ITER = 1_000_000;
// Regularized lower P(a, x) and upper Q(a, x) incomplete gamma (series / Lentz continued fraction).
function gammaPQ(a, x) {
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
function betaI(a, b, x, y = 1 - x) {
  if (x <= 0) return 0;
  if (y <= 0) return 1;
  // x^a (1-x)^b / B(a, b) = (a*b/(a+b)) * dbinom_raw(a; a+b, x, 1-x).
  const front = (a * b / (a + b)) * Math.exp(logBinomialRaw(a, a + b, x, y));
  if (x < (a + 1) / (a + b + 2)) return front * betacf(a, b, x) / a;
  return 1 - front * betacf(b, a, y) / b;
}

// erfc through the incomplete gamma identity erfc(z) = Q(1/2, z^2) for z >= 0.
function erfc(z) {
  if (z === 0) return 1;
  const q = gammaPQ(0.5, z * z);
  return z > 0 ? q.Q : 1 + q.P;
}

// Acklam's rational approximation, then one Halley step against the erfc-based CDF.
const A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
const B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
const C = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
function standardNormalPpf(u) {
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


// ---------- normal family: three named conventions used in the lectures ----------
/** Φ(x) = P(Z ≤ x), the CDF from −∞ (lectures L3, L6). */
export function normalCdf(x) { real(x, 'x'); if (!Number.isFinite(x)) return x > 0 ? 1 : 0; return 0.5 * erfc(-x / Math.SQRT2); }
/** Upper tail 1 − Φ(x), computed without cancellation. */
export function normalSf(x) { real(x, 'x'); if (!Number.isFinite(x)) return x > 0 ? 0 : 1; return 0.5 * erfc(x / Math.SQRT2); }
/** Laplace function Φ₀(x) = Φ(x) − 1/2, the integral from 0 (lecture L12 tables). Odd: Φ₀(−x) = −Φ₀(x). */
export function laplacePhi0(x) {
  real(x, 'x');
  if (x === 0) return 0;
  if (!Number.isFinite(x)) return x > 0 ? 0.5 : -0.5;
  const half = 0.5 * gammaPQ(0.5, x * x / 2).P; // Φ₀(|x|) = P(1/2, x²/2)/2, no subtraction of 1/2
  return x > 0 ? half : -half;
}
/** erf(x) = 2/√π ∫₀ˣ e^(−t²) dt (lecture L9). erf(x) = 2 Φ₀(x√2). */
export function erf(x) {
  real(x, 'x');
  if (x === 0) return 0;
  if (!Number.isFinite(x)) return x > 0 ? 1 : -1;
  const v = gammaPQ(0.5, x * x).P;
  return x > 0 ? v : -v;
}
export { erfc as erfcRaw };
/** z_p with Φ(z_p) = p. */
export function normalQuantile(p) { return standardNormalPpf(prob(p)); }
/** Log-gamma for x > 0. */
export function logGamma(x) { real(x, 'x'); if (!(x > 0) || !Number.isFinite(x)) fail('INVALID_ARGUMENT', 'logGamma needs a finite x > 0'); return lgamma(x); }

// ---------- t, χ², F ----------
/** Student t CDF with df > 0 (non-integer df allowed). */
export function studentTCdf(t, df) {
  real(t, 't'); dof(df);
  if (t === Infinity) return 1; if (t === -Infinity) return 0;
  const x = df / (df + t * t); const y = t * t / (df + t * t);
  const tail = 0.5 * betaI(df / 2, 0.5, x, y); // P(T > |t|)
  return t >= 0 ? 1 - tail : tail;
}
export function studentTSf(t, df) { return studentTCdf(-t, df); }
export function chiSquareCdf(x, df) {
  real(x, 'x'); dof(df);
  if (x <= 0) return 0; if (x === Infinity) return 1;
  return gammaPQ(df / 2, x / 2).P;
}
export function chiSquareSf(x, df) {
  real(x, 'x'); dof(df);
  if (x <= 0) return 1; if (x === Infinity) return 0;
  return gammaPQ(df / 2, x / 2).Q;
}
export function fisherCdf(x, d1, d2) {
  real(x, 'x'); dof(d1, 'd1'); dof(d2, 'd2');
  if (x <= 0) return 0; if (x === Infinity) return 1;
  return betaI(d1 / 2, d2 / 2, d1 * x / (d1 * x + d2), d2 / (d1 * x + d2));
}
export function fisherSf(x, d1, d2) {
  real(x, 'x'); dof(d1, 'd1'); dof(d2, 'd2');
  if (x <= 0) return 1; if (x === Infinity) return 0;
  return betaI(d2 / 2, d1 / 2, d2 / (d1 * x + d2), d1 * x / (d1 * x + d2));
}

// Generic inversion: bracket, then bisection in the tail that keeps precision (lower CDF for p ≤ 1/2,
// upper SF for p > 1/2), finished when the bracket is within a few ulps. Monotone, no derivative needed.
function invert(cdf, sf, p, lo, hi, start) {
  const target = p <= 0.5 ? p : 1 - p;
  const f = p <= 0.5 ? (x) => cdf(x) - target : (x) => target - sf(x);
  let a = lo; let b = hi; let x = start;
  // expand an open bracket geometrically around the start value
  if (!Number.isFinite(b)) { b = Math.max(x, 1); while (f(b) < 0) { a = b; b *= 2; if (b > 1e300) return Infinity; } }
  if (!Number.isFinite(a)) { a = Math.min(x, -1); while (f(a) > 0) { b = a; a *= 2; if (a < -1e300) return -Infinity; } }
  for (let i = 0; i < 2000; i++) {
    const m = 0.5 * (a + b);
    if (m === a || m === b) break;
    if (f(m) < 0) a = m; else b = m;
  }
  return 0.5 * (a + b);
}
export function studentTQuantile(p, df) {
  prob(p); dof(df);
  if (p === 0.5) return 0;
  if (df === 1) return p < 0.5 ? -1 / Math.tan(Math.PI * p) : 1 / Math.tan(Math.PI * (1 - p)); // Cauchy; avoids p - 0.5
  if (df === 2) { const a = 4 * p * (1 - p); return (2 * p - 1) * Math.sqrt(2 / a); } // closed form
  return invert((t) => studentTCdf(t, df), (t) => studentTSf(t, df), p, -Infinity, Infinity, normalQuantile(p));
}
export function chiSquareQuantile(p, df) {
  prob(p); dof(df);
  if (df === 2) return p <= 0.5 ? -2 * Math.log1p(-p) : -2 * Math.log(1 - p); // Exponential, closed form
  return invert((x) => chiSquareCdf(x, df), (x) => chiSquareSf(x, df), p, 0, Infinity, df);
}
export function fisherQuantile(p, d1, d2) {
  prob(p); dof(d1, 'd1'); dof(d2, 'd2');
  return invert((x) => fisherCdf(x, d1, d2), (x) => fisherSf(x, d1, d2), p, 0, Infinity, 1);
}

// ---------- Kolmogorov distribution ----------
/** K(λ) = P(√n·Dₙ ≤ λ) as n → ∞ = 1 − 2 Σ_{k≥1} (−1)^{k−1} e^{−2k²λ²}. For small λ the Jacobi form
 *  K(λ) = (√(2π)/λ) Σ_{k≥1} e^{−(2k−1)²π²/(8λ²)} converges fast and avoids cancellation. */
export function kolmogorovK(lambda) {
  real(lambda, 'lambda');
  if (lambda <= 0) return 0; if (lambda === Infinity) return 1;
  if (lambda < 1) {
    let s = 0;
    for (let k = 1; k < 100; k++) { const t = Math.exp(-((2 * k - 1) ** 2) * Math.PI ** 2 / (8 * lambda * lambda)); s += t; if (t < 1e-17 * s) break; }
    return Math.sqrt(2 * Math.PI) / lambda * s;
  }
  return 1 - kolmogorovSf(lambda);
}
/** 1 − K(λ), computed directly for λ ≥ 1. */
export function kolmogorovSf(lambda) {
  real(lambda, 'lambda');
  if (lambda <= 0) return 1; if (lambda === Infinity) return 0;
  if (lambda < 1) return 1 - kolmogorovK(lambda);
  let s = 0;
  for (let k = 1; k < 100; k++) { const t = Math.exp(-2 * k * k * lambda * lambda); s += (k % 2 ? 1 : -1) * t; if (t < 1e-17) break; }
  return 2 * s;
}
/** λ_α with K(λ_α) = α. */
export function kolmogorovQuantile(alpha) {
  prob(alpha);
  return invert(kolmogorovK, kolmogorovSf, alpha, 0, Infinity, 1);
}
