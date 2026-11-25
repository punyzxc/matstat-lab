// Numbers behind the L6 figure "centre of mass": the balance beam, the 3σ rule and convolution.
// Everything comes from the kernels the stations use: the beam and the laws from lecture-random-vectors (Balance and
// Moments stations, same streams), the sums of uniforms and the Irwin–Hall density from lecture-limit-theorems
// (Convolution station). Same seed and parameters give the stations' own numbers. Pure module: no DOM.
import { fixtureUint32 } from '../../../../simulation-engine/engine.mjs';
import { BEAM, beamLaw, makeLaw, sigmaRule } from '../../../../lecture-random-vectors/kernel.mjs';
import { irwinHallPdf, uniformSums } from '../../../../lecture-limit-theorems/kernel.mjs';

export { BEAM, irwinHallPdf };
const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;

/** The beam's law and n throws on the Balance station's stream: the index of the weight each throw lands on. */
export function beamThrows(params, seed, n) {
  const law = beamLaw(params);
  const cum = [];
  law.p.reduce((a, v, i) => (cum[i] = a + v), 0);
  const last = law.p.findLastIndex((v) => v > 0);
  const hits = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const u = uni(seed, 100, i);
    let k = cum.findIndex((c) => u < c);
    if (k < 0) k = last;
    hits[i] = k;
  }
  return { law, hits };
}
/** Sample mean and variance (divisor n − 1) of the first `count` throws. */
export function throwStats(law, hits, count) {
  let s = 0, s2 = 0;
  for (let i = 0; i < count; i++) { const v = law.x[hits[i]]; s += v; s2 += v * v; }
  const mean = count ? s / count : null;
  return { mean, s2: count > 1 ? (s2 - count * mean * mean) / (count - 1) : null };
}

/** Moments-station law (its fixed p, m, a, b) and n draws on its streams. */
export const lawOf = (law, { lambda, sigma }) => makeLaw(law, { p: 0.3, m: 10, lambda, sigma, a: 2, b: 2 });
export function lawDraws(law, params, seed, n) {
  const L = lawOf(law, params);
  return { L, xs: Float64Array.from({ length: n }, (_, i) => L.sample(seed, i)) };
}
/** Share of the first `count` draws strictly within kσ of the mean, and the exact value. */
export function within(L, xs, k, count = xs.length) {
  const sd = Math.sqrt(L.variance);
  let c = 0;
  for (let i = 0; i < count; i++) if (Math.abs(xs[i] - L.mean) < k * sd) c++;
  return { observed: count ? c / count : null, exact: sigmaRule(L, k) };
}

/** R sums of m uniforms on the Convolution station's streams. */
export const sumsOf = (m, R, seed) => uniformSums(m, R, seed);
/** The convolution integral at z: ∫ f_{m−1}(x) f_U(z − x) dx, by the trapezoid rule over the box [z − 1, z]. */
export function overlap(m, z, steps = 400) {
  if (m <= 1) return z >= 0 && z <= 1 ? 1 : 0;
  const lo = Math.max(0, z - 1), hi = Math.min(m - 1, z);
  if (hi <= lo) return 0;
  const h = (hi - lo) / steps;
  let s = 0;
  for (let i = 0; i <= steps; i++) s += (i === 0 || i === steps ? 0.5 : 1) * irwinHallPdf(lo + i * h, m - 1);
  return s * h;
}
