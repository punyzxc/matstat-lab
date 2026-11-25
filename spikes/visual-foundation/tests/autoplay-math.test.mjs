import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNumberInput, fitToRange, choicesOf, sizeParamOf, grownSize, GROWTH, tickDelay, ridgeOf, traceSummary } from '../src/stations/autoplay-math.mjs';

test('typed numbers: plain, comma decimal, thousands spaces, minus signs, percent', () => {
  assert.equal(parseNumberInput('42'), 42);
  assert.equal(parseNumberInput(' 0,5 '), 0.5);
  assert.equal(parseNumberInput('20 000'), 20000);
  assert.equal(parseNumberInput('−1.5'), -1.5);
  assert.equal(parseNumberInput('5%'), 0.05);
  assert.equal(parseNumberInput('.25'), 0.25);
  assert.equal(parseNumberInput('1e3'), 1000);
});

test('typed numbers: simple arithmetic and constants', () => {
  assert.equal(parseNumberInput('1/3'), 1 / 3);
  assert.equal(parseNumberInput('2^10'), 1024);
  assert.equal(parseNumberInput('(1 + 2) × 3'), 9);
  assert.equal(parseNumberInput('π/4'), Math.PI / 4);
  assert.equal(parseNumberInput('sqrt(2)'), Math.SQRT2);
  assert.equal(parseNumberInput('√9'), 3);
  assert.equal(parseNumberInput('-2^2'), -4);
  assert.equal(parseNumberInput('e'), Math.E);
});

test('typed numbers: rubbish and non-finite results are rejected', () => {
  for (const bad of ['', 'abc', '1+', '(1', '1/0', '2 3', 'alert(1)', '1..2', 'NaN', 'x'.repeat(80)])
    assert.equal(parseNumberInput(bad), null, bad);
});

test('values clamp to the range and snap to the step grid', () => {
  assert.equal(fitToRange(7, 0, 1, 0.3), 1);
  assert.equal(fitToRange(0.31, 0, 1, 0.3), 0.3);
  assert.equal(fitToRange(-5, 100, 20000, 100), 100);
  assert.equal(fitToRange(1234, 100, 20000, 100), 1200);
});

test('a parameter whose label lists its choices becomes a choice', () => {
  const law = { key: 'law', label: 'Law (0 normal, 1 uniform, 2 exponential, 3 Poisson, 4 Cauchy)', min: 0, max: 4, step: 1, default: 4 };
  assert.deepEqual(choicesOf(law), {
    title: 'Law',
    options: [
      { value: 0, label: 'normal' }, { value: 1, label: 'uniform' }, { value: 2, label: 'exponential' },
      { value: 3, label: 'Poisson' }, { value: 4, label: 'Cauchy' },
    ],
  });
  const dot = { key: 'mode', label: 'Experiment (0 bivariate normal · 1 uniform disc · 2 matching problem)', min: 0, max: 2, step: 1, default: 0 };
  assert.deepEqual(choicesOf(dot).options.map((o) => o.label), ['bivariate normal', 'uniform disc', 'matching problem']);
  const tail = { key: 'tail', label: 'H₁ (0 two-sided ≠, 1 right >, 2 left <)', min: 0, max: 2, step: 1, default: 1 };
  assert.deepEqual(choicesOf(tail).options.map((o) => o.label), ['two-sided ≠', 'right >', 'left <']);
  const phi = { key: 'phi', label: 'Function (0 αx + b · 1 eˣ · 2 e^(−βx) · 3 x², x ≥ 0)', min: 0, max: 3, step: 1, default: 2 };
  assert.deepEqual(choicesOf(phi).options.map((o) => o.label), ['αx + b', 'eˣ', 'e^(−βx)', 'x², x ≥ 0']);
  // Numbers, ranges and labels that do not list every value stay numbers.
  assert.equal(choicesOf({ key: 'm', label: 'Uniform terms m', min: 1, max: 6, step: 1, default: 3 }), null);
  assert.equal(choicesOf({ key: 'bins', label: 'Intervals k (0 = 5·lg n)', min: 0, max: 40, step: 1, default: 0 }), null);
  assert.equal(choicesOf({ key: 'k', label: 'Deviation k (view 1)', min: 0.5, max: 4, step: 0.1, default: 3 }), null);
});

test('the size parameter prefers replicates, then trials and sample size', () => {
  const p = (key, max = 1000) => ({ key, label: key, min: 10, max, step: 10, default: 100 });
  assert.equal(sizeParamOf([p('n'), p('R')]).key, 'R');
  assert.equal(sizeParamOf([p('reps'), p('n')]).key, 'n');
  assert.equal(sizeParamOf([p('n'), p('N')]).key, 'N');
  assert.equal(sizeParamOf([p('n')]).key, 'n');
  assert.equal(sizeParamOf([p('n', 30)]), null);
  assert.equal(sizeParamOf([p('p')]), null);
});

test('a growing experiment starts small, grows monotonically and ends at the target', () => {
  const R = { key: 'R', label: 'R', min: 1000, max: 20000, step: 1000, default: 5000 };
  const sizes = GROWTH.map((_, k) => grownSize(R, 12000, k));
  assert.equal(sizes[0], 1000);
  assert.equal(sizes.at(-1), 12000);
  for (let k = 1; k < sizes.length; k++) assert.ok(sizes[k] >= sizes[k - 1]);
  assert.equal(grownSize(R, 12000, 99), 12000);
});

test('the pace never outruns a heavy kernel', () => {
  assert.equal(tickDelay(1, 5), 1100);
  assert.equal(tickDelay(4, 5), 275);
  assert.equal(tickDelay(4, 200), 600);
  assert.ok(tickDelay(1, 5, true) < tickDelay(1, 5));
});

test('draws stack into a ridge surface on the newest grid', () => {
  const row = (draw, shift) => ({ draw, x: [0, 1, 2, 3], y: [0, 1 + shift, 2, 0] });
  assert.equal(ridgeOf([row(1, 0), row(2, 0)], { x: 'x', y: 'draw', z: 'f' }), null);
  const s = ridgeOf([row(1, 0), row(2, 0.5), { draw: 3, x: [0, 1.5, 3], y: [0, 2, 0] }], { x: 'x', y: 'draw', z: 'f' });
  assert.deepEqual(s.x, [0, 1.5, 3]);
  assert.deepEqual(s.y, [1, 2, 3]);
  assert.deepEqual(s.z[0], [0, 1.5, 0]);
  assert.deepEqual(s.z[2], [0, 2, 0]);
});

test('trace summary: mean and spread across draws', () => {
  assert.deepEqual(traceSummary([], 1), { count: 0, mean: null, sd: null });
  const t = traceSummary([1, 2, 3, NaN], 2);
  assert.equal(t.count, 3);
  assert.equal(t.mean, 2);
  assert.equal(t.sd, 1);
  assert.equal(t.theory, 2);
});

// #113: the time machine replays any draw from its seed, so its memory is bounded however long it runs.
import { seedAtDraw, drawOfSeed, timelineAppend, clampSpeed, SPEEDS } from '../src/stations/autoplay-math.mjs';

test('time machine: draw d of an experiment from seed s is seed s + d − 1, and back', () => {
  assert.equal(seedAtDraw(2026, 1), 2026);
  assert.equal(seedAtDraw(2026, 10), 2035);
  assert.equal(seedAtDraw(0xffffffff, 2), 0); // wraps like the seed field
  for (const [o, d] of [[1, 1], [7, 500], [0xfffffff0, 40], [123456, 9999]]) assert.equal(drawOfSeed(o, seedAtDraw(o, d)), d);
});

test('time machine: stepping back drops the future, and the record stays bounded', () => {
  const origin = 50;
  let list = [];
  for (let d = 1; d <= 10000; d++) list = timelineAppend(list, { seed: seedAtDraw(origin, d) }, origin, 240);
  assert.equal(list.length, 240);
  assert.equal(drawOfSeed(origin, list.at(-1).seed), 10000);
  assert.equal(drawOfSeed(origin, list[0].seed), 10000 - 239);
  const back = timelineAppend(list, { seed: seedAtDraw(origin, 9990) }, origin, 240);
  assert.equal(drawOfSeed(origin, back.at(-1).seed), 9990);
  assert.ok(back.every((e, i) => i === 0 || drawOfSeed(origin, e.seed) > drawOfSeed(origin, back[i - 1].seed)));
  assert.equal(back.length, 240 - 11 + 1);
});

test('typed pace: kept between ¼ and 8, 1 when not a number', () => {
  assert.deepEqual(SPEEDS, [0.25, 0.5, 1, 2, 4, 8]);
  assert.equal(clampSpeed(3), 3);
  assert.equal(clampSpeed(0.1), 0.25);
  assert.equal(clampSpeed(100), 8);
  assert.equal(clampSpeed(NaN), 1);
  assert.equal(clampSpeed(-2), 1);
});
