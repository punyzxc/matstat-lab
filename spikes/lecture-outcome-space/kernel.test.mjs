// node --test spikes/lecture-outcome-space/kernel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from './kernel.mjs';

const defaults = Object.fromEntries(K.stations.events.params.map((p) => [p.key, p.default]));
const run = (over, seed = 1) => K.run({ ...defaults, ...over }, { seed, station: 'events' });
const readout = (res, key) => res.readouts.find((r) => r.key === key);
const count = (a) => a.filter(Boolean).length;

test('the outcome spaces of L1: 36 pairs of dice, 8 triples of coins, 36 cards', () => {
  const dice = K.outcomeSpace(0), coins = K.outcomeSpace(1), cards = K.outcomeSpace(2);
  assert.equal(dice.items.length, 36);
  assert.equal(new Set(dice.items.map((it) => it.parts.join())).size, 36);
  assert.equal(coins.items.length, 8);
  assert.equal(new Set(coins.items.map((it) => it.parts.join(''))).size, 8);
  assert.deepEqual(coins.items.map((it) => it.X).sort(), [0, 1, 1, 1, 2, 2, 2, 3]);
  assert.equal(cards.items.length, 36);
  assert.equal(cards.items.filter((it) => it.X === 14).length, 4, 'four aces');
  assert.equal(dice.items.filter((it) => it.X === 7).length, 6);
});

test('operations on events follow set algebra, and P = m/n', () => {
  const a = [true, true, false, false], b = [true, false, true, false];
  assert.deepEqual(K.combine(2, a, b), [true, true, true, false], 'union');
  assert.deepEqual(K.combine(3, a, b), [true, false, false, false], 'product');
  assert.deepEqual(K.combine(4, a, b), [false, false, true, true], 'complement');
  assert.deepEqual(K.combine(5, a, b), [false, true, false, false], 'difference');
  // Two dice: A = {sum ≥ 9} has 10 outcomes, B = {first die = 6} has 6, AB has 4.
  const res = run({ experiment: 0, relA: 0, a: 9, relB: 1, b: 6, op: 2 });
  assert.equal(count(res.space.inA), 10);
  assert.equal(count(res.space.inB), 6);
  assert.equal(res.space.m, 12);
  assert.equal(readout(res, 'event').theory, Number((12 / 36).toPrecision(6)));
  assert.ok(res.formula[1].includes('\\dfrac{10}{36} + \\dfrac{6}{36} - \\dfrac{4}{36} = \\dfrac{12}{36}'), res.formula[1]);
});

test('addition theorem and complement hold for every setting', () => {
  for (const experiment of [0, 1, 2]) for (const relA of [0, 1, 2]) for (const relB of [0, 1, 2]) for (const a of [0, 2, 7, 12]) for (const b of [1, 3]) {
    const r = (op) => run({ experiment, relA, a, relB, b, op }).space.m;
    assert.equal(r(2), r(0) + r(1) - r(3), `union ${experiment} ${relA} ${a} ${relB} ${b}`);
    assert.equal(r(4), run({ experiment }).space.n - r(0), 'complement');
    assert.equal(r(5), r(0) - r(3), 'difference');
  }
});

test('independence: on a 36-card deck, the rank and the suit are independent', () => {
  const res = run({ experiment: 2, relA: 1, a: 14, relB: 1, b: 4, op: 3 }); // ace and hearts
  assert.equal(res.space.m, 1);
  assert.equal(readout(res, 'independent').observed, readout(res, 'independent').theory);
  assert.match(readout(res, 'independent').convention, /independent/);
  const dep = run({ experiment: 0, relA: 0, a: 9, relB: 1, b: 6, op: 3 });
  assert.match(readout(dep, 'independent').convention, /dependent/);
});

test('trials: frequencies within a predeclared band of P (4 standard errors), deterministic, flashes from the picks', () => {
  for (const [experiment, seed] of [[0, 3], [1, 4], [2, 5]]) {
    const n = 20000, res = run({ experiment, n }, seed);
    for (const key of ['event', 'A', 'B', 'AB', 'union']) {
      const r = readout(res, key), p = r.theory;
      assert.ok(Math.abs(r.observed - p) <= 4 * Math.sqrt((p * (1 - p)) / n) + 1e-9, `${experiment} ${key}: ${r.observed} vs ${p}`);
    }
    assert.equal(res.space.flashes.length, K.FLASHES);
    assert.ok(res.space.flashes.every((k) => k >= 0 && k < res.space.n));
    const trace = res.series.find((s) => s.id === 'freq');
    assert.equal(trace.x.at(-1), n);
    assert.equal(trace.y.at(-1), readout(res, 'event').observed);
    assert.equal(JSON.stringify(res), JSON.stringify(run({ experiment, n }, seed)), 'same seed, same bytes');
    assert.notEqual(JSON.stringify(res.space.flashes), JSON.stringify(run({ experiment, n }, seed + 1).space.flashes), 'new seed, new trials');
  }
});

test('contract: aligned finite series, defaults in range, impossible and certain events explained', () => {
  for (const p of K.stations.events.params) assert.ok(p.default >= p.min && p.default <= p.max, p.key);
  const res = run({});
  for (const s of res.series) {
    assert.equal(s.x.length, s.y.length, s.id);
    assert.ok([...s.x, ...s.y].every(Number.isFinite), s.id);
  }
  assert.ok(run({ experiment: 1, relA: 0, a: 9, op: 0 }).notes.some((t) => t.includes('impossible')));
  assert.ok(run({ experiment: 1, relA: 0, a: 0, op: 0 }).notes.some((t) => t.includes('certain')));
});
