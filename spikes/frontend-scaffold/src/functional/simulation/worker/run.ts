import { mulberry32 } from '../../statistics/random/mulberry32';
import type { RunResult, RunSpec } from './protocol';

/** Pure batched run: the Worker and the unit tests call the same function. */
export function runMean(spec: RunSpec, onProgress: (done: number, total: number) => void): RunResult {
  if (!Number.isInteger(spec.n) || spec.n < 1) throw new RangeError('n must be a positive integer');
  if (!Number.isInteger(spec.batch) || spec.batch < 1) throw new RangeError('batch must be a positive integer');
  const random = mulberry32(spec.seed);
  let sum = 0;
  for (let done = 0; done < spec.n; ) {
    const end = Math.min(spec.n, done + spec.batch);
    for (; done < end; done++) sum += random();
    onProgress(done, spec.n);
  }
  return { id: spec.id, seed: spec.seed, n: spec.n, mean: sum / spec.n };
}
