// Run: node --test spikes/station-template/kernel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { meta, stations, run, exactLaw } from './kernel.mjs';

test('the exact laws sum to 1', () => {
  for (const mode of [0, 1]) assert.ok(Math.abs(exactLaw(mode).p.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});

test('contract: every declared station runs; aligned, finite arrays; defaults inside their ranges', () => {
  for (const [id, st] of Object.entries(stations)) {
    for (const p of st.params) assert.ok(p.min <= p.default && p.default <= p.max, `${id}.${p.key}`);
    for (const mode of [0, 1]) {
      const out = run({ mode, n: 600 }, { seed: 7, station: id });
      assert.ok(out.readouts.length && out.series.length && out.notes.length);
      for (const s of out.series) {
        assert.equal(s.x.length, s.y.length, s.id);
        [...s.x, ...s.y].forEach((v) => assert.ok(Number.isFinite(v), s.id));
      }
      assert.equal(out.surface.z.length, out.surface.y.length);
      assert.equal(out.surface.z[0].length, out.surface.x.length);
    }
  }
  assert.equal(meta.params, stations['dice-template'].params);
});

test('seeded: same params and seed give the same bytes; a new seed gives a new sample', () => {
  const a = JSON.stringify(run({ mode: 0, n: 1200 }, { seed: 3 }));
  assert.equal(JSON.stringify(run({ mode: 0, n: 1200 }, { seed: 3 })), a);
  assert.notEqual(JSON.stringify(run({ mode: 0, n: 1200 }, { seed: 4 })), a);
});

test('the sample agrees with the exact law within a predeclared band', () => {
  const n = 18000, out = run({ mode: 0, n }, { seed: 11 });
  const seven = out.readouts.find((r) => r.key === 'top');
  const sd = Math.sqrt((seven.theory * (1 - seven.theory)) / n);
  assert.ok(Math.abs(seven.observed - seven.theory) < 4 * sd, `${seven.observed} vs ${seven.theory}`);
});
