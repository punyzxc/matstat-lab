import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, advance, finish, canonical, validateSpec, retainedBytes, ENGINE_VERSION, RNG_VERSION } from './engine.mjs';

const base = { experiment: 'clt', model: 'exponential', seed: 2048, n: 17, repetitions: 71, retain: 64, engineVersion: ENGINE_VERSION, rngVersion: RNG_VERSION };
function run(spec, batch, draw) {
  const state = createEngine(spec, draw);
  while (!state.done) advance(state, batch);
  return finish(state);
}

test('AC1: canonical results are exact across batch boundaries and unrelated event-loop work', async () => {
  const expected = canonical(run(base, 2048));
  for (const batch of [1, 7, 64, 513]) {
    const state = createEngine(base);
    let steps = 0;
    while (!state.done) {
      advance(state, batch);
      if (++steps % 23 === 0) await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(canonical(finish(state)), expected, `batch=${batch}`);
  }
});

test('AC1: seed endpoints work; unsupported versions and unsafe resource requests fail before allocation', () => {
  for (const seed of [0, 4294967295]) assert.equal(validateSpec({ ...base, seed }).seed, seed);
  for (const patch of [{ seed: -1 }, { seed: 1.5 }, { n: 0 }, { n: Infinity }, { n: 2_000_000, repetitions: 2 }, { retain: 257 }, { engineVersion: 'unknown' }, { rngVersion: 'unknown' }]) {
    assert.throws(() => createEngine({ ...base, ...patch }), error => typeof error.code === 'string');
  }
});

test('AC3: LLN is one stream of prefixes; CLT uses separate complete replicate means', () => {
  const rows = [[0, 1, 0, 1], [0, 0, 0, 1], [1, 1, 1, 0]];
  const lln = run({ ...base, experiment: 'lln', model: 'uniform', n: 4, repetitions: 1, prefixNs: [1, 2, 3, 4] }, 3, (_stream, i) => rows[0][i]);
  assert.deepEqual([...lln.prefixN], [1, 2, 3, 4]);
  for (const [i, expected] of [0, 0.5, 1 / 3, 0.5].entries()) assert.ok(Math.abs(lln.prefixMean[i] - expected) <= 1e-15);
  const seen = new Set();
  const clt = run({ ...base, model: 'uniform', n: 4, repetitions: 3 }, 5, (stream, i) => { seen.add(`${stream}:${i}`); return rows[stream - 1][i]; });
  assert.deepEqual([...clt.means], [0.5, 0.25, 0.75]);
  assert.equal(seen.size, 12);
  assert.equal(clt.theory.mean, 0.5);
  assert.equal(clt.theory.varianceOfMean, 1 / 48);
  assert.equal([...clt.histogram.counts].reduce((a, b) => a + b, 0) + clt.histogram.underflow + clt.histogram.overflow, 3);
});

test('AC2: retained numeric memory is bounded independently of draw count', () => {
  const state = createEngine({ ...base, n: 100, repetitions: 10_000, retain: 64 });
  const allocated = retainedBytes(state);
  assert.ok(allocated <= 1024);
  advance(state, 100_000);
  assert.equal(retainedBytes(state), allocated);
  while (!state.done) advance(state, 2048);
  const result = finish(state);
  assert.equal(result.means.length, 64);
  assert.equal(result.repetitions, 10_000);
  assert.equal(result.retention.policy, 'first-k-means-and-complete-summary');
  assert.equal(result.retention.rawDraws, 0);
});
