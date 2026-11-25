// Inline formula markup and its plain-text fallback (aria labels, titles, <option> text).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mathToPlain, splitMath, texToPlain } from '../src/math-text.mjs';

test('splitMath separates $…$ formulas from text', () => {
  assert.deepEqual(splitMath('plain'), [{ math: false, value: 'plain' }]);
  assert.deepEqual(splitMath('rate $\\lambda$ of $\\xi$.'), [
    { math: false, value: 'rate ' }, { math: true, value: '\\lambda' }, { math: false, value: ' of ' }, { math: true, value: '\\xi' }, { math: false, value: '.' },
  ]);
  assert.deepEqual(splitMath('costs \\$5'), [{ math: false, value: 'costs $5' }]);
  assert.deepEqual(splitMath('a lone $ sign'), [{ math: false, value: 'a lone $ sign' }]);
});

test('texToPlain gives readable Unicode', () => {
  assert.equal(texToPlain('\\bar{x}_n = \\frac{1}{n}\\sum x_i'), 'x̄ₙ = 1/n Σ xᵢ');
  assert.equal(texToPlain('\\chi^2_{1-\\alpha}'), 'χ²_(1-α)');
  assert.equal(texToPlain('p \\pm 3\\sqrt{p(1-p)/n}'), 'p ± 3√(p(1-p)/n)');
  assert.equal(texToPlain('H_0: p = p_0'), 'H₀: p = p₀');
  assert.equal(mathToPlain('Rate $\\lambda$'), 'Rate λ');
  assert.equal(mathToPlain(42), 42);
});
