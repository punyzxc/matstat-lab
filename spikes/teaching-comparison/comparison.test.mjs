// Discovery-only checks for #19. Run from this folder: node --test comparison.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { compare, counterexampleRate, EDGES, expectedError, normalApproxCounterexample, repeated, sample, SIZES } from './comparison.mjs';

const ref = JSON.parse(readFileSync(new URL('./reference.json', import.meta.url), 'utf8'));
const close = (a, e, rel = 1e-12, label = '') => assert.ok(Math.abs(a - e) <= rel * Math.abs(e) + 1e-15, `${label}: ${a} vs ${e}`);
const sameRun = (js, py, label) => {
  for (const size of ['small', 'large']) {
    for (const q of ['mean', 'absError', 'sd', 'ks', 'max']) close(js[size][q], py[size][q], 1e-12, `${label} ${size}.${q}`);
    assert.deepEqual([js[size].n, js[size].counts, js[size].overflow], [py[size].n, py[size].counts, py[size].overflow], `${label} ${size} counts`);
  }
  assert.equal(js.largerIsCloser, py.largerIsCloser, `${label} verdict`);
};

test('AC1: one fixed skewed model, only n varies, and the draw design is explicit', () => {
  assert.deepEqual(SIZES, { small: 10, large: 100 });
  for (const seed of [1, 4, 9]) {
    const small = sample(seed, 'nested', 'small');
    const large = sample(seed, 'nested', 'large');
    assert.deepEqual(small, large.slice(0, 10), 'nested: the small sample is the first 10 draws of the large one');
    const indSmall = sample(seed, 'independent', 'small');
    const indLarge = sample(seed, 'independent', 'large');
    assert.ok(indSmall.every((x) => !indLarge.includes(x)), 'independent: no shared draws');
  }
});

test('AC2: replaying the chosen seeds reproduces the independent Python metrics exactly enough', () => {
  for (const py of ref.runs) sameRun(compare(py.seed, py.design), py, `${py.design} seed ${py.seed}`);
  // Seed 1 is a typical run; seed 4 (independent) and seed 9 (nested) are single-run counterexamples.
  const find = (design, seed) => ref.runs.find((r) => r.design === design && r.seed === seed);
  assert.equal(find('independent', 1).largerIsCloser, true);
  assert.equal(find('independent', 4).largerIsCloser, false);
  assert.equal(find('nested', 9).largerIsCloser, false);
  // The class tally over seeds 1..30 is shareable fixture input for a projector discussion.
  for (const design of ['independent', 'nested']) {
    const ce = [];
    for (let s = 1; s <= 30; s++) if (!compare(s, design).largerIsCloser) ce.push(s);
    assert.deepEqual(ce, ref.classTallySeeds1to30[design], `${design} tally`);
  }
});

test('AC3: repeated runs separate single-run variation from expected estimator error', () => {
  for (const design of ['independent', 'nested']) {
    const js = repeated(1, design, 1000);
    const py = ref.repeatedSeed1[design];
    for (const size of ['small', 'large']) {
      close(js[size].rmse, py[size].rmse, 1e-12, `${design} ${size} rmse`);
      close(js[size].meanAbsError, py[size].meanAbsError, 1e-12, `${design} ${size} mae`);
    }
    assert.equal(js.counterexampleShare, py.counterexampleShare);
  }
  // Theory: RMSE = 1/sqrt(n); E|xbar - 1| for Gamma(n, n) checked against SciPy's numerical expectation.
  for (const [size, n] of Object.entries(SIZES)) {
    close(expectedError(n).rmse, ref.expected.rmse[size], 1e-15, `rmse ${size}`);
    close(expectedError(n).meanAbsError, ref.expected.meanAbsError[size], 1e-8, `mae ${size}`);
  }
  close(normalApproxCounterexample(), ref.expected.normalApproxCounterexample, 1e-15, 'normal approximation');
  // About 1 run in 5 is a counterexample; the 20 000-seed estimate agrees with (2/pi) atan(sqrt(10/100)).
  const rate = counterexampleRate('independent', 20000);
  assert.ok(Math.abs(rate.rate - normalApproxCounterexample()) < 4 * rate.monteCarloSE, JSON.stringify(rate));
  // Shared scale: both runs use the same edges, and counts plus overflow equal n.
  for (const r of ref.runs) for (const size of ['small', 'large']) {
    assert.equal(r[size].counts.length, EDGES.length - 1);
    assert.equal(r[size].counts.reduce((a, b) => a + b, 0) + r[size].overflow, SIZES[size]);
  }
});
