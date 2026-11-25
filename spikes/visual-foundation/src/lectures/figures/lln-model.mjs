// The corridor of running means (L7): the numbers behind the live law-of-large-numbers figure.
// Everything comes from the limit-theorems kernel (spikes/lecture-limit-theorems): the laws, their draws on the
// LLN station's streams, the running means of M paths (`runningMeans`, as the corridor view uses them) and the
// Chebyshev bound. Same seed, law, N, M and ε give exactly the LLN station's corridor. Pure module: no DOM.
import { chebyshevBound, LAWS, runningMeans } from '../../../../lecture-limit-theorems/kernel.mjs';

export { chebyshevBound, LAWS };
/** Draws behind the Chebyshev beat: the LLN station's tail view uses the same count and stream. */
export const TAIL_R = 20000;
const TAIL_STREAM = 900;

/** Centre and scale of a law: the mean and σ, or for Cauchy the centre 0 and the quartile half-width 1. */
export const centreOf = (law) => ({ a: LAWS[law].mean ?? 0, sd: LAWS[law].sd ?? 1, cauchy: LAWS[law].mean == null });

/** R draws of the law on the station's tail stream, and how many lie k σ or more from the mean. */
export function tailDraws({ law, seed, R = TAIL_R }) {
  const L = LAWS[law];
  return Float64Array.from({ length: R }, (_, i) => L.draw(seed, TAIL_STREAM, i));
}
export function tailShare(draws, law, k, count = draws.length) {
  const { a, sd, cauchy } = centreOf(law);
  let hits = 0;
  for (let i = 0; i < count; i++) if (cauchy ? Math.abs(draws[i]) >= k : Math.abs(draws[i] - a) >= k * sd - 1e-12) hits++;
  return count ? hits / count : null;
}
export const exactTail = (law, k) => LAWS[law].tail(k);
export const kBound = (law, k) => (centreOf(law).cauchy ? null : Math.min(1, 1 / (k * k)));

/** M running-mean paths on the log grid of n, and the share outside a ± ε at every grid point. */
export function corridor({ law, N, M, eps, seed }) {
  const { ns, paths } = runningMeans(LAWS[law], N, seed, M);
  const { a, sd, cauchy } = centreOf(law);
  const outside = ns.map((_, j) => paths.reduce((m, y) => m + (Math.abs(y[j] - a) >= eps ? 1 : 0), 0));
  const bound = cauchy ? ns.map(() => null) : ns.map((n) => chebyshevBound(sd, n, eps));
  return { ns, paths, outside, bound, a, sd, cauchy, M };
}
