// node --test spikes/custom-distributions/law.test.mjs
// #88: typed laws are validated with explanations, normalised, and sampled by a seeded inverse CDF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import { kolmogorovQuantile } from '../lecture-special-functions/special.mjs';
import { parseLaw, checkLaw, LAW_PRESETS, LawError, lawPreview } from './law.mjs';

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (tol ${tol})`);
const uni = (seed, i) => (fixtureUint32(seed, 7, i) + 0.5) / 2 ** 32;

test('a discrete law: values | probabilities, sorted, with its moments', () => {
  const law = parseLaw('2 0 1 | 0.3 0.2 0.5');
  assert.deepEqual(law.values, [0, 1, 2]);
  assert.deepEqual(law.probs, [0.2, 0.5, 0.3]);
  close(law.mean, 1.1, 1e-12);
  close(law.variance, 0.49, 1e-12);
  assert.equal(law.cdf(0.99), 0.2);
  assert.equal(law.cdf(1), 0.7);
  assert.equal(law.quantile(0.2), 0);
  assert.equal(law.quantile(0.2000001), 1);
  assert.match(law.tex, /\\begin\{array\}/);
  close(parseLaw('1 2 3 | 1/3 1/3 1/3').mean, 2, 1e-12, 'fractions');
  close(parseLaw('0 1 | 0,25 0,75').mean, 0.75, 1e-12, 'decimal commas');
});

test('discrete validation explains what is wrong (sum to 1 within 1e-9, p ≥ 0)', () => {
  const msg = (t) => checkLaw(t)?.message ?? 'valid';
  assert.match(msg('0 1 2 | 0.2 0.5 0.2'), /add up to 0\.9, not 1/);
  assert.match(msg('0 1 | 1.5 -0.5'), /negative/);
  assert.match(msg('0 1 2 | 0.5 0.5'), /3 values but 2 probabilities/);
  assert.match(msg('0 0 | 0.5 0.5'), /listed twice/);
  assert.match(msg('5 | 1'), /one value, 5/);
  assert.match(msg('1 2 | 1 0'), /one value, 1/);
  assert.match(msg('0 1 | 0.5 0.5000000001'), /^valid$/, 'within 1e-9');
  assert.match(msg('0 1 | 0.5 0.500000002'), /add up to/, 'beyond 1e-9');
  const check = checkLaw('0 1 2 | 0.2 0.5 0.2');
  assert.equal(check.template, 'The probabilities add up to [[1]], not 1.');
  assert.deepEqual(check.values, ['0.9']);
});

test('a continuous law: a formula in x on [a, b], normalised numerically, no eval', () => {
  const tri = parseLaw('2x on [0, 1]');
  close(tri.cdf(0.5), 0.25, 1e-6, 'F(x) = x^2');
  close(tri.mean, 2 / 3, 1e-6);
  close(tri.variance, 1 / 18, 1e-6);
  assert.match(tri.tex, /f\(x\) = \\begin\{cases\} 2x, & x \\in \[0, 1\]/);
  const beta = parseLaw('x(1 - x) on [0, 1]');
  close(beta.c, 6, 1e-5, 'normalising constant');
  assert.match(beta.tex, /c = 6/);
  close(parseLaw('sin x on [0, pi]').c, 0.5, 1e-6);
  close(parseLaw('0,5x на [0; 2]').mean, 4 / 3, 1e-6, 'Russian on, decimal comma, semicolon');
  // Nothing typed reaches eval or Function: names outside the whitelist are refused by the tokenizer.
  for (const evil of ['constructor on [0, 1]', 'alert(1) on [0, 1]', 'x.constructor on [0, 1]', 'process on [0,1]']) assert.ok(checkLaw(evil), evil);
});

test('continuous validation explains what is wrong', () => {
  const msg = (t) => checkLaw(t)?.message ?? 'valid';
  assert.match(msg('x - 0.5 on [0, 1]'), /negative at x = /);
  assert.match(msg('1/(x - 0.5) on [0, 1]'), /negative|not defined/);
  assert.match(msg('sqrt(x) on [-1, 1]'), /not defined at x = /);
  assert.match(msg('x on [1, 0]'), /empty/);
  assert.match(msg('0x on [0, 1]'), /is 0 on the whole interval/);
  assert.match(msg('2x'), /Add the interval/);
  assert.match(msg('2x on [0, 1'), /interval|Expected|Unexpected|Type values/);
  assert.match(msg(''), /Type a law/);
  assert.ok(checkLaw('2x on [0, 1]') === null);
});

test('10^5 seeded draws from each preset stay inside the 99.9% Kolmogorov band of its CDF', () => {
  const n = 1e5, band = kolmogorovQuantile(0.999) / Math.sqrt(n);
  for (const text of LAW_PRESETS) {
    const law = parseLaw(text);
    const x = Float64Array.from({ length: n }, (_, i) => law.quantile(uni(17, i))).sort();
    let d = 0;
    for (let i = 0; i < n; i++) {
      const f = law.cdf(x[i]);
      // For a discrete law compare at the jumps: F_n(x) after all ties against F(x).
      if (law.kind === 'discrete' && i + 1 < n && x[i + 1] === x[i]) continue;
      d = Math.max(d, Math.abs((i + 1) / n - f), law.kind === 'discrete' ? 0 : Math.abs(f - i / n));
    }
    assert.ok(d < band, `${text}: D = ${d} vs band ${band}`);
    assert.deepEqual(Float64Array.from({ length: 50 }, (_, i) => law.quantile(uni(17, i))), x.length && Float64Array.from({ length: 50 }, (_, i) => law.quantile(uni(17, i))), 'seeded');
  }
});

test('the preview draws the pmf or pdf and the CDF', () => {
  const d = lawPreview(parseLaw('0 1 2 | 0.2 0.5 0.3'));
  assert.deepEqual(d.series.map((s) => s.kind), ['pmf', 'ecdf']);
  const c = lawPreview(parseLaw('2x on [0, 1]'));
  assert.deepEqual(c.series.map((s) => s.kind), ['pdf', 'cdf']);
  close(c.series[0].y.at(-1), 2, 1e-9);
  assert.ok(new LawError('x [[1]]', 2).message === 'x 2');
});
