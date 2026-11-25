import assert from 'node:assert/strict';
import { test } from 'node:test';
import katex from 'katex';
import { compileFormula, normalizeValue, variableColor, STANDARD_DEVIATION_FORMULA } from '../src/live-formula-model.mjs';

test('live markers preserve complete TeX structures and generate only internal trusted slots', () => {
  for (const source of [STANDARD_DEVIATION_FORMULA, String.raw`\frac{\v{n}{30}}{2}`, String.raw`\sigma^2 = \v{sigma}{1}^2 = \r{variance}`, String.raw`\sqrt{\v{n}{30}} + \v{n}{30}`]) {
    const formula = compileFormula(source);
    const html = katex.renderToString(formula.tex, { throwOnError: true, strict: 'ignore', trust: ({ command }) => command === '\\htmlData' });
    assert.ok(html.includes('data-live-slot="0"'));
    assert.ok(!html.includes('katex-error'));
  }
  assert.equal(compileFormula(String.raw`\v{n}{30}+\r{mean}`).slots.length, 2);
  assert.throws(() => compileFormula(String.raw`\v{bad"id}{1}`), /variable/);
  assert.throws(() => compileFormula(String.raw`\v{n}{oops}`), /finite/);
  assert.throws(() => compileFormula(String.raw`\v{n}`), /marker/);
});

test('typed values clamp and snap to the declared lattice without accepting partial numbers', () => {
  const range = { min: 0.1, max: 5, step: 0.1 };
  assert.equal(normalizeValue('99', range), 5);
  assert.equal(normalizeValue('-3', range), 0.1);
  assert.equal(normalizeValue('1,26', range), 1.3);
  assert.equal(normalizeValue('1.2e0', range), 1.2);
  for (const value of ['', ' ', '12junk', 'Infinity', 'NaN']) assert.equal(normalizeValue(value, range), null);
  for (const bad of [{ ...range, step: 0 }, { ...range, step: -1 }, { ...range, max: Infinity }, { ...range, min: 6 }]) {
    assert.equal(normalizeValue('1', bad), null);
  }
});

test('a variable keeps its colour across formulas and figures', () => {
  assert.equal(variableColor('sigma'), variableColor('sigma'));
  assert.match(variableColor('n'), /^#[0-9a-f]{6}$/i);
});
