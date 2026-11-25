import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSnap, decodeSnap, decodeSnaps, freeSlot, sameSnap, ghostSeries, sameAxes } from '../src/stations/snapshot-math.mjs';

// #114: a snapshot is its parameters and seed, written into the address and read back unchanged.
test('snapshots: address round trip, hidden flag, texts with any characters', () => {
  const s = { slot: 'B', seed: 4294967295, params: { n: 10, alpha: 0.05, mu: -1.5 }, texts: { region: "y < x^2 ~ 'a' & b" }, hidden: true };
  const code = encodeSnap(s);
  assert.match(code, /^-B4294967295~n:10~alpha:0\.05~mu:-1\.5~region'/);
  assert.deepEqual(decodeSnap(code), s);
  assert.deepEqual(decodeSnap('A7~n:200~law:0'), { slot: 'A', seed: 7, params: { n: 200, law: 0 }, texts: {}, hidden: false });
});

test('snapshots: malformed entries are dropped, one per slot, slot order', () => {
  for (const bad of ['', 'E7', 'A', 'A4294967296', 'a7', 'A7x', null, undefined]) assert.equal(decodeSnap(bad), null, String(bad));
  assert.deepEqual(decodeSnap('A7~n:abc~1x:2~k:3'), { slot: 'A', seed: 7, params: { k: 3 }, texts: {}, hidden: false });
  const list = decodeSnaps(['C1', 'A2', 'C3', 'zzz', 'B4']);
  assert.deepEqual(list.map((s) => s.slot + s.seed), ['A2', 'B4', 'C1']);
});

test('snapshots: at most four slots, a repeated state is the same snapshot', () => {
  const mk = (slot, seed) => ({ slot, seed, params: { n: 1 }, texts: {}, hidden: false });
  assert.equal(freeSlot([]), 'A');
  assert.equal(freeSlot([mk('A', 1), mk('C', 1)]), 'B');
  assert.equal(freeSlot(['A', 'B', 'C', 'D'].map((s) => mk(s, 1))), null);
  assert.ok(sameSnap(mk('A', 5), { ...mk('D', 5), hidden: true }));
  assert.ok(!sameSnap(mk('A', 5), mk('A', 6)));
});

test('snapshots: the ghost keeps only observed series, recoloured to its slot, labelled once', () => {
  const result = {
    series: [
      { id: 'band', kind: 'band', x: [0, 1], y: [0, 0], y2: [1, 1] },
      { id: 'f0', kind: 'cdf', tone: 'signal', x: [0, 1], y: [0, 1], label: 'theory' },
      { id: 'ecdf', kind: 'ecdf', x: [0.2, 0.6], y: [0.5, 1], label: 'sample' },
      { id: 'pts', kind: 'points', tone: 'default', x: [0.2], y: [0.5] },
      { id: 'mark', kind: 'rule', x: [0.4], y: [] },
    ],
  };
  const g = ghostSeries(result, 'C', 'C · n = 10');
  assert.deepEqual(g.map((s) => [s.id, s.kind, s.tone, s.label]), [
    ['ghost-C-ecdf', 'ecdf', 'ghost-c', 'C · n = 10'],
    ['ghost-C-pts', 'points', 'ghost-c', undefined],
  ]);
  assert.ok(sameAxes({ x: 'x', y: 'F' }, { x: 'x', y: 'F' }));
  assert.ok(!sameAxes({ x: 'cell', y: 'F' }, { x: 'x', y: 'F' }));
  assert.ok(sameAxes(undefined, undefined));
});
