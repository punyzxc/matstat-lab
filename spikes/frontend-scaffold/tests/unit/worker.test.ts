import '@vitest/web-worker';
import { describe, expect, it } from 'vitest';
import { runInWorker } from '../../src/functional/simulation/worker/client';
import { runMean } from '../../src/functional/simulation/worker/run';

const spec = { id: 't', seed: 42, n: 10_000, batch: 2_500 };

describe('simulation worker', () => {
  it('the pure run reports every batch and is reproducible for a seed', () => {
    const seen: number[] = [];
    const a = runMean(spec, (done) => seen.push(done));
    expect(seen).toEqual([2_500, 5_000, 7_500, 10_000]);
    expect(runMean(spec, () => {})).toEqual(a);
    expect(a.mean).toBeGreaterThan(0.45);
    expect(a.mean).toBeLessThan(0.55);
  });

  it('rejects invalid sizes instead of looping', () => {
    expect(() => runMean({ ...spec, n: 0 }, () => {})).toThrow(RangeError);
    expect(() => runMean({ ...spec, batch: 0 }, () => {})).toThrow(RangeError);
  });

  // @vitest/web-worker runs the worker module in the same Node process (a shim, not a browser thread).
  // The real browser Worker is covered by tests/e2e/smoke.spec.ts.
  it('the Worker posts progress messages, then the same result as the pure run', async () => {
    const seen: number[] = [];
    const result = await runInWorker(spec, (done) => seen.push(done));
    expect(seen).toEqual([2_500, 5_000, 7_500, 10_000]);
    expect(result).toEqual(runMean(spec, () => {}));
  });

  it('the Worker turns a bad spec into a rejected promise', async () => {
    await expect(runInWorker({ ...spec, n: -1 })).rejects.toThrow('n must be a positive integer');
  });
});
