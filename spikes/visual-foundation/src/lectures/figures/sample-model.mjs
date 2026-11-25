// The living population (#125, L10): the numbers behind the live sampling figure.
// Everything comes from the sampling kernel (spikes/lecture-sampling-goodness-of-fit). The population is
// drawSample(law, N, seed) on stream 0, so its first n members are exactly the Sample station's sample for the
// same seed, law and n: the figure's table, histogram and ECDF are the station's own. Pure module: no DOM.
import { fixtureUint32 } from '../../../../simulation-engine/engine.mjs';
import {
  defaultBinCount, drawSample, ecdf, frequencyTable, kolmogorovCritical, kolmogorovStatistic, LAWS, shapeMoments, variationSeries,
} from '../../../../lecture-sampling-goodness-of-fit/kernel.mjs';

export { LAWS, defaultBinCount };
/** Members of the population drawn on the scene. */
export const POPULATION = 5000;
const JITTER = 0x4a10;

/** The population: N values of the law, and a height in [0, 1) for each, so the cloud fills the density. */
export function population({ law, seed, N = POPULATION }) {
  const x = drawSample(law, N, seed);
  const lift = Array.from({ length: N }, (_, i) => (fixtureUint32(seed, 1, i, JITTER) + 0.5) / 2 ** 32);
  return { x, lift };
}

/**
 * One sample of size n and every portrait of it: the variation series (rank of each observation), the interval
 * frequency table on k intervals (bin of each observation and its slot inside the bin), the ECDF, the moments,
 * and the largest gap D_n between the ECDF and the true F.
 */
export function describe({ law, n, bins = 0, seed, alpha = 0.05 }) {
  const x = drawSample(law, n, seed);
  const k = bins > 0 ? Math.round(bins) : defaultBinCount(n);
  const order = x.map((_, i) => i).sort((a, b) => x[a] - x[b] || a - b);
  const rank = new Array(n);
  order.forEach((i, r) => (rank[i] = r));
  const table = frequencyTable(x, k);
  const lo = table.edges[0];
  const bin = x.map((v) => Math.min(k - 1, Math.floor((v - lo) / table.h)));
  // the slot of each observation in its bin's stack: in rank order, so stacks build from left to right
  const filled = new Array(k).fill(0), slot = new Array(n);
  for (const i of order) slot[i] = filled[bin[i]]++;
  const F = ecdf(x);
  const vs = variationSeries(x);
  const m = shapeMoments(x);
  const law_ = LAWS[law];
  const ks = kolmogorovStatistic(x, law_.cdf);
  // F_n just after each observation, as the ECDF counts ties: #{x_j <= x_i}/n
  const fnAt = x.map((v) => F.y[F.x.indexOf(v)]);
  return {
    x, n, k, rank, order, bin, slot, fnAt, table, ecdf: F, sorted: vs.sorted,
    mean: m.mean, s2: m.s2, min: vs.sorted[0], max: vs.sorted[n - 1], median: median(vs.sorted),
    sum: table.counts.reduce((s, c) => s + c, 0),
    dn: ks.d, dAt: ks.at, lambda: ks.d * Math.sqrt(n), critical: kolmogorovCritical(n, alpha),
    a: law_.mean, variance: law_.variance,
  };
}

const median = (s) => (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2);

/** Where the ECDF and F are furthest apart: the side of the jump at x where the gap is attained. */
export function gapAt(d, F) {
  const i = d.order.find((j) => d.x[j] === d.dAt);
  const r = d.rank[i], f = F(d.dAt);
  const after = d.fnAt[i], before = r / d.n;
  return Math.abs(after - f) >= Math.abs(f - before) ? { x: d.dAt, from: f, to: after } : { x: d.dAt, from: before, to: f };
}

/** The value axis: the law's range, widened to hold every observation. */
export const axisOf = (law, d) => [Math.min(LAWS[law].range[0], d.min), Math.max(LAWS[law].range[1], d.max)];
