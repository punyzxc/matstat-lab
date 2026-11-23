// Discovery-only checks. No product modules, generator code, or codecs are imported.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const fixtures = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url), 'utf8'));
const get = (id) => {
  const value = fixtures.cases.find((entry) => entry.id === id);
  assert.ok(value, `missing independent case: ${id}`);
  return value.expected;
};
const close = (actual, expected, absolute = 1e-12, relative = 1e-10) => {
  assert.ok(Number.isFinite(actual), `nonfinite value: ${actual}`);
  assert.ok(Math.abs(actual - expected) <= absolute + relative * Math.abs(expected),
    `${actual} differs from ${expected}`);
};

test('AC1: exact anchors distinguish scale, rate, variance, and sample variance', () => {
  assert.equal(get('uniform-shifted').pdf, 0.25);
  assert.equal(get('uniform-shifted').cdf, 0.25);
  assert.equal(get('normal-shifted').cdf, 0.5);
  close(get('normal-shifted').pdf, 0.09973557010035818);
  close(get('exponential-rate-two').cdf, 0.8646647167633873);
  assert.equal(get('exponential-rate-two').mean, 0.5);
  assert.equal(get('exponential-rate-two').variance, 0.25);
  close(get('binomial-ten-quarter').pmf, 0.25028228759765625);
  close(get('binomial-ten-quarter').cdf, 0.7758750915527344);
  close(get('poisson-two').pmf, 0.1804470443154836);
  close(get('poisson-two').cdf, 0.8571234604985472);
  assert.deepEqual(get('summary-five'), {
    n: 5, mean: 3, variancePopulation: 2, varianceSample: 2.5,
  });
});

test('AC1: independently known normal and Student-t interval/test anchors', () => {
  close(get('normal-central-95').upper, 1.959963984540054);
  close(get('normal-central-95').lower, -1.959963984540054);
  assert.equal(get('t-df-one').df, 1);
  close(get('t-df-one').statistic, 1);
  close(get('t-df-one').pTwoSided, 0.5);
  close(get('t-df-one').ci95[0], -11.706204736174696);
  close(get('t-df-one').ci95[1], 13.706204736174696);
  assert.equal(get('t-df-four').df, 4);
  close(get('t-df-four').statistic, 4.242640687119285);
  close(get('t-df-four').pTwoSided, 0.013235599563682695);
  close(get('t-df-four').ci95[0], 1.036756838522439);
  close(get('t-df-four').ci95[1], 4.963243161477561);
  close(get('normal-right-tail-eight').sf, 6.220960574271784e-16, 1e-28, 1e-10);
});

test('AC1: versioned integer RNG vectors and open-unit interval are reproducible', () => {
  assert.equal(fixtures.rng.algorithm, 'xorshift32-13-17-5/open-midpoint-v1');
  assert.deepEqual(fixtures.rng.vectors[0].words.slice(0, 5),
    [270369, 67634689, 2647435461, 307599695, 2398689233]);
  assert.deepEqual(fixtures.rng.vectors[1].words.slice(0, 5),
    [253983, 4228382207, 1958451267, 4056713434, 2049502865]);
  for (const vector of fixtures.rng.vectors) {
    assert.equal(vector.words.length, 8);
    vector.words.forEach((word, index) => {
      assert.ok(Number.isInteger(word) && word >= 0 && word < 2 ** 32);
      assert.equal(vector.uniformOpen[index], (word + 0.5) / 2 ** 32);
      assert.ok(vector.uniformOpen[index] > 0 && vector.uniformOpen[index] < 1);
    });
  }
  assert.equal(fixtures.rng.zeroSeedPolicy, 'reject');
});

test('AC1: every case carries explicit parameters, provenance, and tolerances', () => {
  assert.equal(fixtures.generator.python, '3.12.14');
  assert.equal(fixtures.generator.oracle, 'CPython standard library + analytical identities');
  const ids = fixtures.cases.map(({ id }) => id);
  assert.equal(new Set(ids).size, ids.length);
  for (const entry of fixtures.cases) {
    assert.ok(Object.keys(entry.parameters).length > 0);
    assert.ok(entry.reference.length > 0);
    assert.ok(entry.tolerance.absolute >= 0 && entry.tolerance.relative >= 0);
  }
});

// AC3 is a typed *oracle specimen*, not an application serializer or schema.
function equalTyped(actual, expected) {
  if (typeof actual !== typeof expected) return false;
  if (actual === null || expected === null) return actual === expected;
  if (typeof expected === 'number') return Number.isFinite(actual) && Object.is(actual, expected);
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length
      && expected.every((value, index) => equalTyped(actual[index], value));
  }
  if (typeof expected === 'object') {
    const a = Object.keys(actual).sort();
    const e = Object.keys(expected).sort();
    return a.length === e.length && e.every((key, index) => key === a[index]
      && equalTyped(actual[key], expected[key]));
  }
  return actual === expected;
}

test('AC3: independent typed oracle detects subtle roundtrip corruption', () => {
  const expected = {
    schemaVersion: 1, seed: '1', status: 'completed',
    parameters: { rate: 2 }, result: [0.1, 1.0000000000000002, 1e-200],
  };
  const parsed = JSON.parse(JSON.stringify(expected));
  assert.ok(equalTyped(parsed, expected));
  assert.ok(equalTyped({ ...parsed, parameters: { rate: 2 } }, expected));
  const mutations = [
    { ...parsed, schemaVersion: '1' },
    { ...parsed, seed: 1 },
    { ...parsed, status: 'cancelled' },
    { ...parsed, result: [0.1, 1, 1e-200] },
    { ...parsed, result: [0.1, 1e-200, 1.0000000000000002] },
    { ...parsed, result: [0.1, 1.0000000000000002, null] },
    { ...parsed, unexpected: true },
    { ...parsed, parameters: {} },
  ];
  mutations.forEach((value) => assert.equal(equalTyped(value, expected), false));
  assert.equal(equalTyped(JSON.parse(JSON.stringify({ x: -0 })), { x: -0 }), false);
  assert.equal(equalTyped(JSON.parse(JSON.stringify({ x: NaN })), { x: NaN }), false);
  assert.equal(equalTyped(JSON.parse(JSON.stringify({ x: Infinity })), { x: Infinity }), false);
  assert.equal(equalTyped(JSON.parse(JSON.stringify({ x: undefined })), { x: undefined }), false);
});
