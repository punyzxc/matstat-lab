// Special functions for the sampling and goodness-of-fit kernel (#45).
// Local copies under the names agreed for the shared module (#54, spikes/lecture-special-functions/special.mjs),
// so that switching to the shared module later is a change of import path only.
// Pure functions, no dependencies, double precision. Each one is checked against closed forms in kernel.test.mjs.

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** ln Γ(x) for x > 0 (Lanczos, g = 7), with the reflection formula below 1/2. */
export function lnGamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const TINY = 1e-300;
/** Regularized lower incomplete gamma P(a, x) = γ(a, x)/Γ(a). */
export function gammaP(a, x) {
  if (!(a > 0)) throw new RangeError('gammaP needs a > 0');
  if (x <= 0) return 0;
  if (x === Infinity) return 1;
  return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinued(a, x);
}
/** Regularized upper incomplete gamma Q(a, x) = 1 − P(a, x), accurate in the far tail. */
export function gammaQ(a, x) {
  if (!(a > 0)) throw new RangeError('gammaQ needs a > 0');
  if (x <= 0) return 1;
  if (x === Infinity) return 0;
  return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinued(a, x);
}
function gammaSeries(a, x) {
  let ap = a, del = 1 / a, sum = del;
  for (let i = 0; i < 10000; i++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-17) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}
function gammaContinued(a, x) {
  let b = x + 1 - a, c = 1 / TINY, d = 1 / b, h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
}

/** erf(x) = P(1/2, x²) with the sign of x. Not the same function as the lecture's Ф (see the module map). */
export function erf(x) {
  if (x === 0) return 0;
  const v = gammaP(0.5, x * x);
  return x > 0 ? v : -v;
}
/** erfc(x) = 1 − erf(x), without cancellation for large x. */
export function erfc(x) {
  return x >= 0 ? gammaQ(0.5, x * x) : 1 + gammaP(0.5, x * x);
}

/** Φ(x): the standard normal CDF, P(ξ ≤ x) = ∫_{−∞}^{x}. */
export function normalCdf(x) {
  return x < 0 ? 0.5 * erfc(-x / Math.SQRT2) : 1 - 0.5 * erfc(x / Math.SQRT2);
}
/** Φ₀(x) = Φ(x) − 1/2: the lecture-12 Laplace function, integrated from 0. */
export function laplacePhi0(x) {
  return x < 0 ? -laplacePhi0(-x) : 0.5 - 0.5 * erfc(x / Math.SQRT2);
}
export const normalPdf = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

/** Φ⁻¹(p): Abramowitz–Stegun 26.2.23 start, then Newton steps on Φ (lower tail kept for accuracy). */
export function normalQuantile(p) {
  if (!(p > 0 && p < 1)) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    throw new RangeError('normalQuantile needs 0 ≤ p ≤ 1');
  }
  if (p > 0.5) return -normalQuantile(1 - p);
  const t = Math.sqrt(-2 * Math.log(p));
  let x = -(t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t));
  for (let i = 0; i < 6; i++) {
    const step = (normalCdf(x) - p) / normalPdf(x);
    x -= step;
    if (Math.abs(step) < 1e-15 * Math.max(1, Math.abs(x))) break;
  }
  return x;
}

/** χ²(k) CDF: P(k/2, x/2). */
export const chiSquareCdf = (x, k) => gammaP(k / 2, x / 2);
/** χ²(k) upper tail (p-value of a Pearson statistic). */
export const chiSquareSf = (x, k) => gammaQ(k / 2, x / 2);

/** χ²ₚ(k): the p-quantile, P(χ²(k) ≤ q) = p. Bisection on the CDF. */
export function chiSquareQuantile(p, k) {
  if (!(k > 0)) throw new RangeError('chiSquareQuantile needs k > 0');
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;
  let lo = 0, hi = Math.max(1, k);
  while (chiSquareCdf(hi, k) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-14 * hi; i++) {
    const mid = 0.5 * (lo + hi);
    if (chiSquareCdf(mid, k) < p) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Kolmogorov's limit law K(λ) = Σ_{k=−∞}^{∞} (−1)^k e^{−2k²λ²} = lim P(√n·Dₙ < λ).
 * The alternating series converges slowly for small λ, so below 1.18 the equivalent theta form
 * K(λ) = (√(2π)/λ) Σ_{j≥1} e^{−(2j−1)²π²/(8λ²)} is used.
 */
export function kolmogorovK(lambda) {
  if (!(lambda > 0)) return 0;
  if (lambda < 1.18) return kolmogorovKTheta(lambda);
  return kolmogorovKAlternating(lambda);
}
export function kolmogorovKTheta(lambda) {
  let s = 0;
  for (let j = 1; j < 200; j++) {
    const term = Math.exp(-((2 * j - 1) ** 2) * Math.PI * Math.PI / (8 * lambda * lambda));
    s += term;
    if (term < 1e-18 * s) break;
  }
  return (Math.sqrt(2 * Math.PI) / lambda) * s;
}
export function kolmogorovKAlternating(lambda) {
  let s = 0;
  for (let k = 1; k < 200; k++) {
    const term = Math.exp(-2 * k * k * lambda * lambda);
    s += k % 2 ? term : -term;
    if (term < 1e-18) break;
  }
  return 1 - 2 * s;
}
/** λ with K(λ) = p (λ₀.₉₅ ≈ 1.358 is the critical value of √n·Dₙ at α = 0.05). */
export function kolmogorovQuantile(p) {
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;
  let lo = 0, hi = 1;
  while (kolmogorovK(hi) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-15; i++) {
    const mid = 0.5 * (lo + hi);
    if (kolmogorovK(mid) < p) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Exact finite-n law of the two-sided statistic: P(Dₙ < d) for a continuous hypothesised F.
 * Marsaglia, Tsang & Wang (2003), "Evaluating Kolmogorov's distribution", J. Stat. Software 8(18),
 * with decimal exponent tracking so that n up to a few thousand does not overflow.
 */
export function kolmogorovExactCdf(n, d) {
  if (!(d > 0)) return 0;
  if (d >= 1) return 1;
  const nd = n * d;
  if (nd <= 0.5) return 0; // Dₙ ≥ 1/(2n) always
  const k = Math.floor(nd) + 1, m = 2 * k - 1, h = k - nd;
  const H = new Float64Array(m * m);
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) H[i * m + j] = i - j + 1 >= 0 ? 1 : 0;
  for (let i = 0; i < m; i++) {
    H[i * m] -= h ** (i + 1);
    H[(m - 1) * m + i] -= h ** (m - i);
  }
  if (2 * h - 1 > 0) H[(m - 1) * m] += (2 * h - 1) ** m;
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
    const q = i - j + 1;
    if (q > 0) for (let g = 1; g <= q; g++) H[i * m + j] /= g;
  }
  const { Q, e } = matrixPower(H, m, n);
  let s = Q[(k - 1) * m + k - 1], exp10 = e;
  for (let i = 1; i <= n; i++) {
    s = (s * i) / n;
    if (s < 1e-140) { s *= 1e140; exp10 -= 140; }
  }
  return Math.min(1, Math.max(0, s * 10 ** exp10));
}
function matrixMultiply(A, B, m) {
  const C = new Float64Array(m * m);
  for (let i = 0; i < m; i++) for (let l = 0; l < m; l++) {
    const a = A[i * m + l];
    if (a === 0) continue;
    for (let j = 0; j < m; j++) C[i * m + j] += a * B[l * m + j];
  }
  return C;
}
function matrixPower(A, m, n) {
  if (n === 1) return { Q: A, e: 0 };
  const half = matrixPower(A, m, Math.floor(n / 2));
  let Q = matrixMultiply(half.Q, half.Q, m), e = 2 * half.e;
  if (n % 2) Q = matrixMultiply(A, Q, m);
  if (Q[Math.floor(m / 2) * m + Math.floor(m / 2)] > 1e140) {
    for (let i = 0; i < m * m; i++) Q[i] *= 1e-140;
    e += 140;
  }
  return { Q, e };
}
