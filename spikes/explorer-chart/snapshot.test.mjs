import assert from 'node:assert/strict';
import test from 'node:test';
import { oldFixture, storedRun } from './fixture.mjs';
import { decode, exportJson, exportCsv, report } from './snapshot.mjs';

test('JSON round trips the entire completed result and versions', () => {
  assert.deepEqual(decode(exportJson(storedRun)), { ok: true, snapshot: storedRun });
});

test('legacy records migrate without mutation and future versions remain unsupported', () => {
  const old = oldFixture();
  assert.deepEqual(decode(old), { ok: true, snapshot: storedRun });
  assert.equal(old.schemaVersion, 0);
  assert.equal(decode({ ...old, schemaVersion: 9 }).code, 'unsupported-version');
});

test('corrupt records and inconsistent plot coordinates are rejected', () => {
  assert.equal(decode('{').code, 'invalid-snapshot');
  for (const mutate of [
    r => { r.spec.seed = 2 ** 32; },
    r => { r.execution.status = 'paused'; },
    r => { r.series.histogram.counts[0] = 1; r.series.histogram.counts[1] = 3; },
    r => { r.series.ecdf.cumulativeCounts[2] = 3; },
    r => { r.retained.values[1] = NaN; },
    r => { r.observed.mean = Infinity; },
  ]) {
    const bad = structuredClone(storedRun);
    mutate(bad);
    assert.equal(decode(bad).code, 'invalid-snapshot');
  }
});

test('CSV retains draw order and values with reproducibility metadata', () => {
  const [header, ...rows] = exportCsv(storedRun).trimEnd().split('\r\n').map(line => line.split(','));
  assert.deepEqual(header, ['id','module','seed','rng_version','algorithm_version','draw','value']);
  assert.deepEqual(rows.map(row => Number(row[6])), storedRun.retained.values);
  assert.ok(rows.every(row => row[0] === storedRun.id && row[2] === String(storedRun.spec.seed)));
  assert.deepEqual(rows.map(row => Number(row[5])), [1, 2, 3, 4, 5]);
});

test('the report keeps actual and theoretical measures distinct and discloses retention', () => {
  const view = report(storedRun);
  assert.deepEqual(view.observed, { mean: 1.1 });
  assert.deepEqual(view.theory, { mean: 1.5 });
  assert.equal(view.totalDraws, 5);
  assert.equal(view.savedDraws, 5);
  assert.deepEqual(view.warnings, ['OUTSIDE_PLOT_DOMAIN']);
});
