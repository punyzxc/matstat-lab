// The confidence interval wall (#112): the numbers behind the L11 lecture figure.
// Samples and intervals come from the estimation kernel (spikes/lecture-estimation-intervals) with the same
// streams as its coverage run (stream 100 + n, replicate r), so the wall's hit count over R intervals equals
// the Confidence Intervals station's coverage for the same seed, n and γ.
// Pure module: no DOM.
import { approxMeanInterval, sampleOf, tMeanInterval } from '../../../../lecture-estimation-intervals/kernel.mjs';

export const LAWS = Object.freeze([
  { id: 'normal', label: 'N(\\mu,\\,\\sigma^2)' },
  { id: 'skewed', label: '\\text{skewed}' },
]);
export const METHODS = Object.freeze([
  { id: 't', label: 't_{\\gamma}', build: tMeanInterval },
  { id: 'z', label: 'z_{\\gamma}', build: approxMeanInterval },
]);

/** Interval r for the mean: the sample, x̄, s, the bounds and whether it covers μ. */
export function intervalAt({ n, gamma, law = 0, method = 0, mu = 0, sigma = 1, seed, r }) {
  const x = sampleOf({ law, mu, sigma, n, seed, stream: 100 + n, r });
  const ci = METHODS[method].build(x, gamma);
  return { r, sample: x, estimate: ci.estimate, lower: ci.lower, upper: ci.upper, critical: ci.critical, hit: ci.lower <= mu && mu <= ci.upper };
}

/** The first `count` intervals and their running coverage. */
export function wall(o, count) {
  const list = [];
  let hits = 0, width = 0;
  for (let r = 0; r < count; r++) {
    const iv = intervalAt({ ...o, r });
    hits += iv.hit ? 1 : 0;
    width += iv.upper - iv.lower;
    list.push(iv);
  }
  return { list, hits, coverage: count ? hits / count : null, meanWidth: count ? width / count : null };
}
