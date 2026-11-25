// These are systems UNDER audit. Expected observations/counts never come from them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { decode as decodeV1, exportJson, exportCsv } from '../explorer-chart/snapshot.mjs';
import { decode as decodeV2 } from '../snapshot-comparison-fields/snapshot-v2.mjs';
import { auditSnapshot, auditCsv, independentlyCount } from './oracle.mjs';

const load = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const fixtures = load('./fixtures.json').cases;
const saved = load('./saved-precision-v2.json');
const precision = fixtures.find(f => f.id === 'precision-near-edges');

function versionOne(value) {
  const { axis, statistics, migratedFrom, ...core } = structuredClone(value);
  const { kind: histogramKind, normalization, ...histogram } = core.series.histogram;
  const { kind: ecdfKind, scale, ...ecdf } = core.series.ecdf;
  return { ...core, schemaVersion: 1, series: { histogram, ecdf } };
}

for (const f of fixtures) {
  test(`existing v2 decoder agrees with independent fixture: ${f.id}`, () => {
    const input = structuredClone(saved);
    input.axis.units = f.units;
    input.spec.sampleSize = f.observations.length;
    input.retained.values = [...f.observations];
    input.series.histogram = { kind: 'histogram', normalization: 'count', ...structuredClone(f.histogram) };
    input.series.ecdf = { kind: 'ecdf', scale: 'count', ...structuredClone(f.ecdf) };
    const result = decodeV2(JSON.stringify(input));
    assert.equal(result.ok, true);
    assert.deepEqual(auditSnapshot(result.snapshot, f), []);
  });
}

test('existing v1 JSON exporter preserves precision and numerical series against originals', () => {
  const input = versionOne(saved);
  const text = exportJson(input);
  const parsed = JSON.parse(text);
  assert.deepEqual(parsed, input);
  assert.deepEqual(parsed.retained.values, precision.observations);
  assert.deepEqual(parsed.series.histogram, precision.histogram);
  assert.deepEqual(parsed.series.ecdf, precision.ecdf);
  assert.equal(decodeV1(text).ok, true);
  const migrated = decodeV2(text);
  assert.equal(migrated.ok, true);
  assert.equal(migrated.snapshot.axis.units, null);
  assert.deepEqual(auditSnapshot(migrated.snapshot, precision), ['units']);
});

test('existing v1 CSV exporter retains all values and provenance but omits units', () => {
  const text = exportCsv(versionOne(saved));
  const result = auditCsv(text, precision, saved);
  assert.deepEqual(result.values, precision.observations);
  assert.deepEqual(result.issues, ['csv-units-missing']);
});

test('signed-zero probe exposes JSON and CSV normalization that needs a contract policy', () => {
  const input = versionOne(saved);
  input.spec.sampleSize = 1;
  input.retained.values = [-0];
  input.series = {
    histogram: { edges: [-1, 1], counts: [1], underflow: 0, overflow: 0 },
    ecdf: { x: [-0], cumulativeCounts: [1] },
  };
  assert.equal(decodeV1(input).ok, true);
  assert.ok(Object.is(input.retained.values[0], -0));
  const parsed = JSON.parse(exportJson(input));
  assert.ok(Object.is(parsed.retained.values[0], 0));
  assert.equal(Object.is(parsed.retained.values[0], -0), false);
  const result = auditCsv(exportCsv(input), { observations: [-0], units: 's' }, input);
  assert.deepEqual(result.issues, ['csv-values', 'csv-units-missing']);
  assert.ok(Object.is(result.values[0], 0));
});

test('existing decoder independently rejects equal-total histogram/rank mutations', () => {
  const f = fixtures.find(f => f.id === 'unequal-widths');
  const input = structuredClone(saved);
  input.spec.sampleSize = f.observations.length;
  input.retained.values = [...f.observations];
  input.series.histogram = { kind: 'histogram', normalization: 'count', ...structuredClone(f.histogram) };
  input.series.ecdf = { kind: 'ecdf', scale: 'count', ...structuredClone(f.ecdf) };
  const bins = structuredClone(input); bins.series.histogram.counts = [4,4];
  const ranks = structuredClone(input); ranks.series.ecdf.cumulativeCounts = [2,3,4,5,7,8,9,10];
  assert.equal(decodeV2(bins).ok, false);
  assert.equal(decodeV2(ranks).ok, false);
  assert.deepEqual(auditSnapshot(bins, f), ['histogram-membership']);
  assert.deepEqual(auditSnapshot(ranks, f), ['ecdf-ranks']);
});

test('a self-consistent rounded replacement cannot fool the external observation witness', () => {
  const changed = structuredClone(saved);
  changed.retained.values = changed.retained.values.map(value => Number(value.toFixed(2)));
  const recounted = independentlyCount(changed.retained.values, precision.histogram.edges);
  changed.series.histogram = { kind: 'histogram', normalization: 'count', ...recounted.histogram };
  changed.series.ecdf = { kind: 'ecdf', scale: 'count', ...recounted.ecdf };
  // A self-consistency codec cannot recover observations that were already replaced.
  assert.equal(decodeV2(changed).ok, true);
  const issues = auditSnapshot(changed, precision);
  assert.ok(issues.includes('retained-values'));
  assert.ok(issues.includes('histogram-membership'));
  assert.ok(issues.includes('ecdf-support'));
});
