// Throwaway Discovery spike for issue #46. Not product code.
// Local copies of the special functions that #54 (spikes/lecture-special-functions/special.mjs)
// will share. The names match #54 so that the switch is a one-line import change.
// normalQuantile and studentTQuantile are copied from spikes/inference-methods (PR #25).

/** erf(x), Taylor series near 0 and a Lentz continued fraction for erfc in the tails. */
export function erf(x) { return 1 - erfc(x); }
function erfc(x) {
  const z = Math.abs(x);
  if (z < 2) {
    let sum = z, term = z, n = 0;
    do { n++; term *= -z * z / n; sum += term / (2 * n + 1); } while (Math.abs(term / (2 * n + 1)) > 1e-17 * Math.abs(sum));
    const e = 2 / Math.sqrt(Math.PI) * sum;
    return x >= 0 ? 1 - e : 1 + e;
  }
  let f = z, C = z, D = 0;
  for (let i = 1; i < 300; i++) {
    const an = i / 2;
    D = 1 / (z + an * D);
    C = z + an / C;
    const delta = C * D; f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  const r = Math.exp(-z * z) / Math.sqrt(Math.PI) / f;
  return x >= 0 ? r : 2 - r;
}

/** Φ(x) = P(Z ≤ x), the standard normal CDF integrated from −∞ (L3, L6 convention). */
export function normalCdf(x) { return 0.5 * erfc(-x / Math.SQRT2); }
/** Φ₀(x) = Φ(x) − 1/2, the Laplace function integrated from 0 (L12 convention). */
export function laplacePhi0(x) { return normalCdf(x) - 0.5; }

/** Acklam's rational approximation, refined by one Halley step. */
export function normalQuantile(p) {
  if (!(p > 0 && p < 1)) throw new RangeError('p must be in (0, 1)');
  if (p > 0.5) return -normalQuantile(1 - p);
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  let x;
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else {
    const q = p - 0.5, r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const e = normalCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return x - u / (1 + x * u / 2);
}

export function logGamma(x) { // Lanczos, g = 7
  const g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let s = g[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) s += g[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
}

function betacf(a, b, x) { // Numerical Recipes 6.4
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
const tUpper = (t, df) => regIncBeta(df / 2, 0.5, df / (df + t * t)) / 2;
export function studentTCdf(t, df) { return t >= 0 ? 1 - tUpper(t, df) : tUpper(-t, df); }
export function studentTQuantile(p, df) {
  if (!(p > 0 && p < 1)) throw new RangeError('p must be in (0, 1)');
  if (!(Number.isInteger(df) && df >= 1)) throw new RangeError('df must be a positive integer');
  if (p === 0.5) return 0;
  if (p < 0.5) return -studentTQuantile(1 - p, df);
  const tail = 1 - p;
  let lo = 0, hi = 1;
  while (tUpper(hi, df) > tail) { lo = hi; hi *= 2; if (!Number.isFinite(hi)) return Infinity; }
  for (let i = 0; i < 2000 && hi - lo > 4 * Number.EPSILON * hi; i++) {
    const mid = (lo + hi) / 2;
    if (tUpper(mid, df) > tail) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Regularized lower incomplete gamma P(a, x): series below a + 1, continued fraction above (NR 6.2). */
export function regLowerGamma(a, x) {
  if (x <= 0) return 0;
  const lg = logGamma(a);
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 1; n < 10000; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-17) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lg);
  }
  const tiny = 1e-300;
  let b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d;
  for (let i = 1; i < 10000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lg) * h;
}
export function chiSquareCdf(x, df) { return regLowerGamma(df / 2, x / 2); }
/** The p-quantile of χ² with df degrees of freedom: bisection on the CDF, no tables. */
export function chiSquareQuantile(p, df) {
  if (!(p > 0 && p < 1)) throw new RangeError('p must be in (0, 1)');
  if (!(df > 0)) throw new RangeError('df must be positive');
  let lo = 0, hi = Math.max(1, df);
  while (chiSquareCdf(hi, df) < p) { lo = hi; hi *= 2; }
  for (let i = 0; i < 2000 && hi - lo > 4 * Number.EPSILON * hi; i++) {
    const mid = (lo + hi) / 2;
    if (chiSquareCdf(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
