// Numbers behind the L5 figure "a random variable is a function": the two-dice mapping X(ω), its staircase F(x) and
// the continuous laws with F(x) as the area under the density. Every draw is the Distribution function station's own
// (lecture-random-vectors, station `cdf`: same seed, streams and indices). Pure module: no DOM.
import { fixtureUint32 } from '../../../../simulation-engine/engine.mjs';
import { CDF_LAWS, diceMapping, trapezoid } from '../../../../lecture-random-vectors/kernel.mjs';

const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;

/** X on the 36 outcomes, its values and their probabilities, and n experiments: the outcome each one picks. */
export function dice(map, a, b, seed, n) {
  const values = diceMapping(map, a, b);
  const support = [...new Set(values)].sort((p, q) => p - q);
  const pmf = support.map((v) => values.filter((w) => w === v).length / 36);
  const picks = new Int8Array(n), xs = new Float64Array(n);
  for (let i = 0; i < n; i++) { picks[i] = Math.floor(uni(seed, 116, i) * 36); xs[i] = values[picks[i]]; }
  return { values, support, pmf, picks, xs, mean: values.reduce((p, q) => p + q, 0) / 36 };
}
/** F(x) = P(X ≤ x) of the dice variable: the sum of p_k over x_k ≤ x. */
export const diceF = ({ support, pmf }, x) => support.reduce((s, v, i) => (v <= x ? s + pmf[i] : s), 0);
export const diceJump = ({ support, pmf }, x) => { const i = support.indexOf(x); return i < 0 ? 0 : pmf[i]; };

/** A continuous law of the station (1 uniform, 2 exponential, 3 normal) and n draws on its stream. */
export function continuous(source, seed, n) {
  const law = CDF_LAWS[source];
  return { law, xs: Float64Array.from({ length: n }, (_, i) => law.sample(seed, i)) };
}
/** The area under the density to the left of x, by the station's own quadrature. */
export const areaLeft = (law, x) => trapezoid(law.pdf, law.from, Math.min(x, law.to), 4000);

/** Empirical F_n(x), the share of values exactly x and the mean, over the first `count` values. */
export function empirical(xs, x, count = xs.length) {
  let le = 0, eq = 0, s = 0;
  for (let i = 0; i < count; i++) { if (xs[i] <= x) le++; if (xs[i] === x) eq++; s += xs[i]; }
  return count ? { F: le / count, jump: eq / count, mean: s / count } : { F: null, jump: null, mean: null };
}
