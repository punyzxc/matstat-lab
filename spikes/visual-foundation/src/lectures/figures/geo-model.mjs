// Numbers behind the L4 figure "darts on a board": additivity, area as probability, Buffon's needle and the Bertrand
// chords. Every draw is the Darts station's own (lecture-geometric-probability: same seed, streams and indices), so a
// figure and its station agree to the last digit. Pure module: no DOM.
import { fixtureUint32 } from '../../../../simulation-engine/engine.mjs';
import { BERTRAND, BOARD, bertrandChord, buffonNeedle, buffonP, checkpoints } from '../../../../lecture-geometric-probability/kernel.mjs';

export { BERTRAND, BOARD, buffonP };
const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;

/**
 * N darts in the unit square. `from` is the first index: the quarter-disc view counts darts 0 … N − 1, the typed
 * region view counts 1 … N (both on streams 30 and 31), exactly as the station does.
 */
export function darts(seed, N, from = 0) {
  const xs = new Float64Array(N), ys = new Float64Array(N);
  for (let k = 0; k < N; k++) { xs[k] = uni(seed, 30, k + from); ys[k] = uni(seed, 31, k + from); }
  return { xs, ys };
}

/** The two events of the additivity beat: A = {x < a}, B = {x > 1 − b}. They are disjoint while a + b ≤ 1. */
export const inA = (x, a) => x < a;
export const inB = (x, b) => x > 1 - b;
/** The same union, typed for the Darts station's region view. */
export const unionText = (a, b) => `x < ${fmt(a)} or x > ${fmt(1 - b)}`;
const fmt = (v) => String(Number(v.toFixed(4)));

/** Counts of the first `count` darts in A, B, A ∪ B and AB, and the exact areas. */
export function additive({ xs }, a, b, count = xs.length) {
  let mA = 0, mB = 0, mU = 0, mAB = 0;
  for (let k = 0; k < count; k++) {
    const p = inA(xs[k], a), q = inB(xs[k], b);
    if (p) mA++;
    if (q) mB++;
    if (p || q) mU++;
    if (p && q) mAB++;
  }
  const both = Math.max(0, a + b - 1);
  return { mA, mB, mU, mAB, count, exact: { A: a, B: b, U: Math.min(1, a + b), AB: both } };
}

/** Share of the first `count` darts inside the quarter disc x² + y² ≤ 1, and 4 times it. */
export function quarter({ xs, ys }, count = xs.length) {
  let m = 0;
  for (let k = 0; k < count; k++) if (xs[k] * xs[k] + ys[k] * ys[k] <= 1) m++;
  return { m, share: count ? m / count : null, pi: count ? (4 * m) / count : null };
}

/** N needles, index 1 … N as on the station: the crossing test and where the picture places each needle. */
export function needles(seed, N, lTyped, d) {
  const l = Math.min(lTyped, d);
  const hit = new Uint8Array(N), x = new Float64Array(N), y = new Float64Array(N), theta = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const i = k + 1, nd = buffonNeedle(seed, i, l, d);
    hit[k] = nd.hit ? 1 : 0;
    theta[k] = nd.theta;
    x[k] = BOARD.width * d * uni(seed, 52, i);
    y[k] = Math.floor(BOARD.strips * uni(seed, 53, i)) * d + nd.off;
  }
  return { l, d, hit, x, y, theta };
}
/** Crossings among the first `count` needles and the estimate π̂ = 2ln/(dm). */
export function crossings({ l, d, hit }, count = hit.length) {
  let m = 0;
  for (let k = 0; k < count; k++) m += hit[k];
  return { m, share: count ? m / count : null, pi: m ? (2 * l * count) / (d * m) : null };
}

/** N chords per Bertrand method, index 1 … N: the counting draw u (stream 40 + j) and the turning angle (60 + j). */
export function chords(seed, N) {
  return BERTRAND.map((s, j) => {
    const long = new Uint8Array(N), ends = new Float64Array(4 * N);
    for (let k = 0; k < N; k++) {
      const i = k + 1, u = uni(seed, 40 + j, i);
      long[k] = s.long(u, 0) ? 1 : 0;
      ends.set(bertrandChord(s.id, u, 2 * Math.PI * uni(seed, 60 + j, i)), 4 * k);
    }
    return { id: s.id, exact: s.exact, long, ends };
  });
}
export function longShare({ long }, count = long.length) {
  let m = 0;
  for (let k = 0; k < count; k++) m += long[k];
  return count ? m / count : null;
}

/** The running estimate of π at log-spaced n: 4m/n for the quarter disc, 2ln/(dm) for the needles. */
export function piPath(source, N) {
  const ns = checkpoints(N, 160), out = [];
  let m = 0, k = 0;
  const needle = 'hit' in source;
  for (let i = 0; i < N && k < ns.length; i++) {
    m += needle ? source.hit[i] : source.xs[i] * source.xs[i] + source.ys[i] * source.ys[i] <= 1 ? 1 : 0;
    if (i + 1 === ns[k]) {
      const n = i + 1;
      if (!needle) out.push([n, (4 * m) / n]);
      else if (m) out.push([n, (2 * source.l * n) / (source.d * m)]);
      k++;
    }
  }
  return out;
}
