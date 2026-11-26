// The hypothesis court (L12): the numbers behind the live testing figure.
// Everything comes from the hypothesis-tests kernel (spikes/lecture-hypothesis-tests): the critical region,
// the exact power of the z-test, and the seeded replicates of `simulateMean` (stream `mean`, common random
// numbers), so the figure's decisions are the Testing station's own (same seed, n, alpha, tail). Pure module.
import { criticalRegion, simulateMean, TAILS, zPower } from '../../../../lecture-hypothesis-tests/kernel.mjs';

export { TAILS };
const tailOf = (i) => TAILS[Math.round(i)] ?? 'two';

/** The critical region of the z-test at level alpha: reject below `lower` or above `upper` (null: open side). */
export const regionOf = (alpha, tail) => criticalRegion({ kind: 'z' }, alpha, tailOf(tail));
export const rejects = (u, r) => (r.lower !== null && u < r.lower) || (r.upper !== null && u > r.upper);

/** Exact errors of the z-test for H0: a = a0 against the true effect d = (a - a0)/sigma with n observations. */
export function errorsOf({ n, d, alpha, tail }) {
  const region = regionOf(alpha, tail), power = zPower(d, n, alpha, tailOf(tail));
  return { region, delta: d * Math.sqrt(n), alpha, power: d === 0 ? null : power, beta: d === 0 ? null : 1 - power };
}

/**
 * The statistics U of the first R seeded samples, judged twice on the same draws: when H0 is true (d = 0) and when
 * the truth is d. The share rejected tends to alpha and to the power 1 - beta.
 */
export function courtCases({ n, d, alpha, tail, seed, R }) {
  const common = { n, R, seed, sigmaKnown: true, alpha, tail: tailOf(tail), keepStats: true };
  const h0 = simulateMean({ ...common, grid: [0] }), h1 = simulateMean({ ...common, grid: [d] });
  return { h0: h0.stats, h1: h1.stats, hits0: h0.hits[0], hits1: h1.hits[0] };
}

/** The power curve 1 - beta(d) on a grid: exact, and simulated from R seeded samples per point. */
export function powerCurve({ n, alpha, tail, seed, R, grid }) {
  const exact = grid.map((d) => zPower(d, n, alpha, tailOf(tail)));
  const mc = simulateMean({ n, R, seed, sigmaKnown: true, alpha, tail: tailOf(tail), grid });
  return { grid, exact, simulated: mc.hits.map((h) => h / R), R };
}

export const phi = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
