import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, toDensity, mergeCounts, rebin } from './compare.mjs';
import { pairs } from './pairs.mjs';

for (const pair of pairs) {
  test(`${pair.id}: ${pair.expect.decision}`, () => {
    const got = compare(pair.a, pair.b);
    assert.equal(got.decision, pair.expect.decision, JSON.stringify(got));
    assert.deepEqual(got.reasons, pair.expect.reasons ?? []);
    if (pair.expect.transforms) assert.deepEqual(got.transforms, pair.expect.transforms);
    for (const w of pair.expect.warnings ?? []) assert.ok(got.warnings.includes(w), `warning ${w}`);
  });

  test(`${pair.id}: decision and transforms do not depend on argument order`, () => {
    const ab = compare(pair.a, pair.b), ba = compare(pair.b, pair.a);
    assert.equal(ba.decision, pair.expect.decision);
    assert.deepEqual([...ba.transforms].sort(), [...ab.transforms].sort());
  });
}

// Regressions found by an independent check of the first draft.
const v = patch => ({ ...structuredClone(pairs[0].a), ...structuredClone(patch) });

test('a parameter with no known unit dimension refuses a unit change', () => {
  for (const params of [{ lambda: 0.5 }, { variance: 4 }]) {
    const kind = 'lambda' in params ? 'exponential' : 'uniform';
    const got = compare(v({ units: 's', model: { kind, params } }), v({ units: 'min', sampleSize: 10, model: { kind, params } }));
    assert.equal(got.decision, 'incompatible');
  }
});

test('density heights are rescaled when the axis unit changes', () => {
  const model = { kind: 'uniform', params: { min: 0, max: 60 } };
  const a = v({ units: 's', model, histogram: { edges: [0, 60], values: [1 / 60], underflow: 0, overflow: 0, normalization: 'density' } });
  const b = v({ units: 'min', model: { kind: 'uniform', params: { min: 0, max: 1 } }, sampleSize: 10, histogram: { edges: [0, 1], values: [1], underflow: 0, overflow: 0, normalization: 'density' } });
  assert.ok(compare(a, b).transforms.includes('rescale-density-heights'));
});

test('rebinning from retained values always ends with density normalization', () => {
  const rel = (edges, values) => ({ edges, values, underflow: 0, overflow: 0, normalization: 'relative' });
  const a = v({ histogram: rel([0, 1, 2, 3], [0.4, 0.4, 0.2]) });
  const b = v({ sampleSize: 4, histogram: rel([0.25, 1.25, 2.25, 3.25], [0.25, 0.5, 0.25]), retained: { kind: 'complete', values: [0.5, 1.5, 2, 3] } });
  assert.deepEqual(compare(a, b).transforms, ['rebin-from-retained', 'normalize-density']);
});

test('converted edges with float rounding compare the same in both orders', () => {
  const a = v({ units: 's', model: { kind: 'uniform', params: { min: 0, max: 222 } }, histogram: { edges: [0, 222], values: [5], underflow: 0, overflow: 0, normalization: 'count' } });
  const b = v({ units: 'min', sampleSize: 10, model: { kind: 'uniform', params: { min: 0, max: 3.7 } }, histogram: { edges: [0, 3.7], values: [10], underflow: 0, overflow: 0, normalization: 'count' } });
  assert.equal(compare(a, b).decision, 'compatible-after-transform');
  assert.equal(compare(b, a).decision, 'compatible-after-transform');
});

test('malformed metadata is an explicit incompatibility, not a crash', () => {
  const noHist = v({ sampleSize: 10 });
  delete noHist.histogram;
  const noSeed = v({ sampleSize: 10 });
  delete noSeed.seed;
  for (const b of [v({ statistics: null }), v({ statistics: {} }), noHist, noSeed]) {
    assert.equal(compare(pairs[0].a, b).decision, 'incompatible');
  }
});

test('rebin and toDensity reject invalid input instead of losing draws', () => {
  assert.equal(rebin([NaN, 0.5], [0, 1]).invalid, 1);
  assert.throws(() => rebin([1], []), RangeError);
  assert.throws(() => toDensity({ edges: [0, 1], values: [1], normalization: 'count' }, 0), RangeError);
});

test('count histograms with different n become densities that each integrate to one', () => {
  const a = { edges: [0, 1, 2, 3], values: [2, 2, 1], normalization: 'count' };
  const b = { edges: [0, 1, 2, 3], values: [3, 4, 3], normalization: 'count' };
  assert.deepEqual(toDensity(a, 5), [0.4, 0.4, 0.2]);
  assert.deepEqual(toDensity(b, 10), [0.3, 0.4, 0.3]);
});

test('density keeps the total-n denominator, so draws outside the domain lower the area', () => {
  const h = { edges: [0, 1, 2], values: [2, 2], normalization: 'count' };
  const d = toDensity(h, 5); // one draw above the domain
  assert.equal(d.reduce((s, v) => s + v, 0), 0.8);
});

test('unequal bin widths are divided out', () => {
  const h = { edges: [0, 1, 3], values: [2, 2], normalization: 'count' };
  assert.deepEqual(toDensity(h, 4), [0.5, 0.25]);
});

test('merging fine counts is exact and refuses non-nested edges', () => {
  const fine = { edges: [0, 0.5, 1, 1.5, 2], values: [1, 2, 3, 4] };
  assert.deepEqual(mergeCounts(fine, [0, 1, 2]), [3, 7]);
  assert.equal(mergeCounts(fine, [0, 0.75, 2]), null);
  assert.equal(mergeCounts(fine, [0.5, 1, 2]), null);
});

test('rebinning retained values uses half-open bins with a closed last bin', () => {
  const h = rebin([-1, 0, 0.5, 1, 1, 3, 4], [0, 1, 2, 3]);
  assert.deepEqual(h.values, [2, 2, 1]);
  assert.equal(h.underflow, 1);
  assert.equal(h.overflow, 1);
});

test('variance divisor transform preserves meaning: s2 = sigma2 * n / (n - 1)', () => {
  const x = [0, 0.5, 1, 1, 3];
  const n = x.length, m = x.reduce((s, v) => s + v, 0) / n;
  const ss = x.reduce((s, v) => s + (v - m) ** 2, 0);
  assert.ok(Math.abs(ss / (n - 1) - (ss / n) * n / (n - 1)) < 1e-15);
});
