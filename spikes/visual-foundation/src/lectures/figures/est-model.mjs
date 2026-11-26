// Clouds of estimates and the n vs n − 1 race (#135): the numbers behind the L11 "estimate cloud" figure.
// Samples come from the estimation kernel (spikes/lecture-estimation-intervals) with the Estimation station's
// streams (stream 1000 + n, replicate r), so R samples here give exactly the station's bias readouts for the
// same seed, n, σ and law. Pure module: no DOM.
import { mean, sampleOf, sumSquares } from '../../../../lecture-estimation-intervals/kernel.mjs';

export const MU = 0;
/** Sample sizes of the consistency ladder under the cloud. */
export const LADDER = Object.freeze([2, 5, 10, 20, 50]);

/** Replicate r: the sample, its mean and both variance estimates (divisor n and n − 1). */
export function estimatesAt({ n, law = 0, sigma = 1, seed, r }) {
  const x = sampleOf({ law, mu: MU, sigma, n, seed, stream: 1000 + n, r });
  const ss = sumSquares(x);
  return { r, sample: x, mean: mean(x), vn: ss / n, vn1: ss / (n - 1) };
}

/** Running summary of the first `count` replicates: mean and spread of x̄, means of both variance estimates. */
export function race(o, count) {
  let m = 0, m2 = 0, vn = 0, vn1 = 0, vn1sq = 0;
  for (let r = 0; r < count; r++) {
    const e = estimatesAt({ ...o, r });
    m += e.mean; m2 += e.mean * e.mean; vn += e.vn; vn1 += e.vn1; vn1sq += e.vn1 * e.vn1;
  }
  const c = Math.max(1, count);
  const meanX = m / c, varX = count > 1 ? (m2 - c * meanX * meanX) / (count - 1) : NaN;
  const meanN1 = vn1 / c, varN1 = count > 1 ? (vn1sq - c * meanN1 * meanN1) / (count - 1) : NaN;
  return { count, meanX, sdX: Math.sqrt(varX), meanN: vn / c, meanN1, seN1: Math.sqrt(varN1 / c) };
}

/** Theory: spread of x̄ and the expectations of both variance estimates. */
export function theory(n, sigma) {
  const s2 = sigma * sigma;
  return { sdX: sigma / Math.sqrt(n), meanN: ((n - 1) / n) * s2, meanN1: s2, bias: -s2 / n };
}
