import test from 'node:test';
import assert from 'node:assert/strict';
import { collect, histogram, moments, sources } from '../src/statistics.ts';

const run = { distribution: 'normal', count: 512, scale: 1, seed: 2048 };

test('a pinned seed replays every observation', () => {
  assert.deepEqual(collect(run), collect(run));
  assert.notDeepEqual(collect(run), collect({ ...run, seed: 2049 }));
  assert.equal(collect(run).length, 512);
});

test('bin density integrates to visible probability and preserves overflow', () => {
  const result = histogram([-2, -1, -0.1, 0.2, 0.9, 1, 4], [-1, 1], 2);
  assert.deepEqual(result.counts, [2, 3]);
  assert.equal(result.outside, 2);
  assert.ok(Math.abs(result.density.reduce((a, b) => a + b, 0) - 5 / 7) < 1e-12);
});

test('summary reports sample variance and handles an empty run', () => {
  assert.deepEqual(moments([1, 2, 3]), { mean: 2, variance: 1, deviation: 1 });
  assert.equal(moments([]), null);
  assert.equal(moments([1]).variance, null);
});

test('model distributions expose matching density, CDF and moments', () => {
  assert.ok(Math.abs(sources.normal.cdf(0, 1) - 0.5) < 1e-6);
  assert.equal(sources.uniform.cdf(0, 2), 0.5);
  assert.equal(sources.uniform.density(3, 2), 0);
  assert.equal(sources.exponential.cdf(-2, 1), 0);
  assert.ok(Math.abs(sources.exponential.cdf(1, 1) - (1 - Math.exp(-1))) < 1e-12);
  assert.deepEqual(sources.exponential.theory(2), [2, 4]);
});

import { moduleReadout } from '../src/method-readouts.ts';

test('method previews agree with hand-computed mean, error and interval', () => {
  const sample = [1,2,3,4];
  assert.equal(moduleReadout('convergence', sample, run).value, '2.5000');
  assert.equal(moduleReadout('estimation', sample, run).value, (Math.sqrt(5/3)/2).toFixed(4));
  const r = Math.sqrt(5);
  assert.equal(moduleReadout('confidence', sample, run).value, `[${(2.5-r).toFixed(4)}, ${(2.5+r).toFixed(4)}]`);
});

test('sign and run previews handle ties, both tails and draw order', () => {
  assert.equal(moduleReadout('testing', [0,1,2,3,4], run).value, '0.1250');
  assert.equal(moduleReadout('testing', [-1,-2,3,4], run).value, '1.0000');
  assert.equal(moduleReadout('testing', [-1,-2,-3,4], run).value, '0.6250');
  assert.equal(moduleReadout('randomness', [-1,0,2,-3,4], run).value, '4');
});
