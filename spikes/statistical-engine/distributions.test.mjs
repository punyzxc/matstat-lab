// Discovery-only checks for #13. Run from this folder: node --test distributions.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { create, DistributionError, ecdf, histogram, integerEdges } from './distributions.mjs';

const ref = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url), 'utf8'));
const num = (v) => (v === 'inf' ? Infinity : v === '-inf' ? -Infinity : v === 'nan' ? NaN : v);
const model = (id) => {
  const m = ref.models.find((c) => c.id === id);
  assert.ok(m, `missing reference case ${id}`);
  return { m, d: create(id.split('-')[0], m.params) };
};
// Proposed comparator: |a - e| <= abs + rel * |e|. Tiers are documented in docs/research/statistical-engine.md.
const TIER = {
  closedForm: { abs: 1e-300, rel: 1e-14 },
  special: { abs: 1e-300, rel: 1e-13 },
  largeCdf: { abs: 1e-300, rel: 1e-12 },
};
const close = (actual, expected, { abs, rel }, label) => {
  expected = num(expected);
  if (Object.is(actual, expected)) return;
  assert.ok(Number.isFinite(actual), `${label}: nonfinite ${actual}`);
  assert.ok(Math.abs(actual - expected) <= abs + rel * Math.abs(expected), `${label}: ${actual} vs ${expected}`);
};
const CONTINUOUS = ['normal-standard', 'normal-shifted', 'normal-large', 'uniform-unit', 'uniform-shifted', 'uniform-wide',
  'exponential-rate-one', 'exponential-rate-two', 'exponential-rate-large'];
const DISCRETE_SMALL = ['bernoulli-0', 'bernoulli-1', 'bernoulli-0.3', 'binomial-ten-quarter', 'binomial-n0', 'binomial-p0',
  'binomial-p1', 'poisson-two', 'poisson-zero'];
const DISCRETE_LARGE = ['binomial-large', 'binomial-rare', 'poisson-large'];

test('AC1: continuous PDF, CDF, SF and moments match SciPy, including support endpoints', () => {
  for (const id of CONTINUOUS) {
    const { m, d } = model(id);
    assert.equal(d.measure, 'pdf');
    for (const p of m.points) {
      // SciPy 1.18.1 flushes Phi(-38) ~ 2.885e-316 to 0; the mpmath oracle below covers that point.
      if (Math.abs(p.x) === 38) continue;
      for (const q of ['pdf', 'cdf', 'sf']) close(d[q](p.x), p[q], TIER.special, `${id} ${q}(${p.x})`);
    }
    for (const [q, e] of Object.entries(m.moments)) close(d.moments[q], e, TIER.closedForm, `${id} ${q}`);
  }
  // Closed endpoints: SciPy evaluates the density at both ends of Uniform and at 0 for Exponential.
  assert.equal(model('uniform-shifted').d.pdf(2), 0.25);
  assert.equal(model('uniform-shifted').d.pdf(6), 0.25);
  assert.equal(model('exponential-rate-two').d.pdf(0), 2);
  assert.equal(model('exponential-rate-two').d.pdf(-1e-300), 0);
});

test('AC1: discrete PMF, CDF and SF match SciPy; degenerate laws are exact point masses', () => {
  for (const id of DISCRETE_SMALL) {
    const { m, d } = model(id);
    assert.equal(d.measure, 'pmf');
    for (const p of m.points) for (const q of ['pmf', 'cdf', 'sf']) close(d[q](p.x), p[q], TIER.special, `${id} ${q}(${p.x})`);
    close(d.moments.mean, m.moments.mean, TIER.closedForm, `${id} mean`);
    close(d.moments.variance, m.moments.variance, TIER.closedForm, `${id} variance`);
  }
  for (const id of ['bernoulli-0', 'bernoulli-1', 'binomial-n0', 'binomial-p0', 'binomial-p1', 'poisson-zero']) {
    const { d } = model(id);
    // SciPy returns nan, inf or -9.2e18 here; the proposal is null with an explicit degenerate flag.
    assert.deepEqual([d.moments.skewness, d.moments.excessKurtosis, d.moments.degenerate], [null, null, true], id);
  }
  assert.equal(model('binomial-n0').d.pmf(0), 1);
  assert.equal(model('poisson-zero').d.pmf(0), 1);
  assert.equal(model('binomial-p1').d.pmf(7), 1);
  // Non-integer points are allowed for the CDF (step function) and carry no mass.
  assert.equal(model('bernoulli-0.3').d.pmf(0.5), 0);
  assert.equal(model('bernoulli-0.3').d.cdf(0.5), model('bernoulli-0.3').d.cdf(0));
});

test('AC2: large parameters match the 50-digit mpmath oracle, where SciPy itself drifts', () => {
  let scipyWorst = 0;
  for (const id of [...DISCRETE_LARGE, 'normal-standard']) {
    const { m, d } = model(id);
    for (const hp of m.highPrecision) {
      for (const q of ['pmf', 'logpmf', 'cdf']) {
        if (!(q in hp)) continue;
        close(d[q](hp.x), hp[q], q === 'cdf' ? TIER.largeCdf : TIER.special, `${id} ${q}(${hp.x})`);
        const s = num(m.points.find((p) => p.x === hp.x)[q]);
        if (hp[q] !== 0 && Number.isFinite(s) && s !== 0) scipyWorst = Math.max(scipyWorst, Math.abs(s - hp[q]) / Math.abs(hp[q]));
      }
    }
  }
  // Evidence, not a requirement on SciPy: its large-parameter Poisson PMF is off by about 1e-9.
  assert.ok(scipyWorst > 1e-10, `expected the recorded SciPy drift, got ${scipyWorst}`);
  // CDFs stay monotone and normalized across the bulk of a large law.
  const { d } = model('poisson-large');
  let prev = 0;
  for (let k = 995_000; k <= 1_005_000; k += 500) { const c = d.cdf(k); assert.ok(c >= prev && c <= 1); prev = c; }
});

test('AC2: inverse-CDF samplers reproduce SciPy ppf on fixed uniforms; discrete draws are exact integers', () => {
  for (const m of ref.models) {
    const d = create(m.id.split('-')[0], m.params);
    for (const { u, x } of m.ppf) {
      const got = d.ppf(u);
      if (d.measure === 'pmf') {
        assert.ok(Number.isSafeInteger(got), `${m.id} ppf(${u}) is not an integer`);
        assert.equal(got, x, `${m.id} ppf(${u})`);
      } else {
        close(got, x, TIER.special, `${m.id} ppf(${u})`);
      }
    }
  }
  assert.deepEqual(ref.uniforms, [2 ** -33, 0.025, 0.25, 0.5, 0.75, 0.975, 1 - 2 ** -33]);
});

test('AC2: invalid parameters and uniforms fail with typed errors', () => {
  const bad = [['normal', { mu: 0, sigma: 0 }], ['normal', { mu: NaN, sigma: 1 }], ['uniform', { a: 1, b: 1 }],
    ['uniform', { a: -Number.MAX_VALUE, b: Number.MAX_VALUE }], ['exponential', { rate: 0 }], ['bernoulli', { p: 1.5 }],
    ['binomial', { n: 2.5, p: 0.5 }], ['binomial', { n: -1, p: 0.5 }], ['poisson', { rate: -1 }], ['poisson', { rate: Infinity }]];
  for (const [family, params] of bad) {
    assert.throws(() => create(family, params), (e) => e instanceof DistributionError && e.code === 'INVALID_PARAMETER', `${family} ${JSON.stringify(params)}`);
  }
  for (const u of [0, 1, NaN]) assert.throws(() => create('exponential', { rate: 1 }).ppf(u), { code: 'INVALID_UNIFORM' });
});

test('AC2: singleton and tied samples follow NumPy/SciPy summary, histogram and ECDF conventions', () => {
  for (const s of ref.samples) {
    const h = histogram(s.sample, s.histogram.edges);
    assert.deepEqual([h.counts, h.underflow, h.overflow], [s.histogram.counts, s.histogram.underflow, s.histogram.overflow]);
    assert.equal(h.counts.reduce((a, b) => a + b, 0) + h.underflow + h.overflow, s.n);
    h.densityHeights.forEach((v, i) => close(v, s.histogram.densityHeights[i], TIER.closedForm, `${s.id} density ${i}`));
    assert.deepEqual(ecdf(s.sample), s.ecdf);
  }
  const single = ref.samples.find((s) => s.id === 'singleton');
  assert.equal(single.varianceDivisorNMinus1, 'nan', 'n-1 variance of one draw is undefined, not 0');
  // The last bin is closed: a draw on the final edge is counted, not overflow.
  assert.deepEqual(histogram([0, 6], [0, 2, 4, 6]).counts, [1, 0, 1]);
});

test('AC3: unit-width integer bins make a discrete histogram height equal relative frequency, comparable to PMF', () => {
  const edges = integerEdges(0, 3);
  assert.deepEqual(edges, [-0.5, 0.5, 1.5, 2.5, 3.5]);
  const draws = [0, 1, 1, 2, 2, 2, 3, 3];
  const h = histogram(draws, edges);
  assert.deepEqual(h.densityHeights, [1 / 8, 2 / 8, 3 / 8, 2 / 8]);
  // No draw can sit on an edge, so the half-open/closed rule never decides a discrete count.
  assert.ok(draws.every((x) => !edges.includes(x)));
  // The discrete ECDF jumps at the support points and is flat between them (right-continuous).
  assert.deepEqual(ecdf(draws), { x: [0, 1, 2, 3], p: [1 / 8, 3 / 8, 6 / 8, 1] });
});

test('Normal CDF and SF reach their limits at infinite and huge arguments instead of NaN', () => {
  const d = create('normal', { mu: 0, sigma: 1 });
  for (const x of [Infinity, 1e200, 50]) {
    assert.equal(d.cdf(x), 1); assert.equal(d.sf(x), 0);
    assert.equal(d.cdf(-x), 0); assert.equal(d.sf(-x), 1);
  }
});
