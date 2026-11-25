import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { independentlyCount, auditSnapshot, auditCsv } from './oracle.mjs';

const root = new URL('./', import.meta.url);
const fixtures = JSON.parse(readFileSync(new URL('fixtures.json', root), 'utf8')).cases;
const byId = id => fixtures.find(f => f.id === id);
const saved = JSON.parse(readFileSync(new URL('saved-precision-v2.json', root), 'utf8'));
const csv = readFileSync(new URL('saved-precision-v1.csv', root), 'utf8');

function record(f) {
  return {
    schemaVersion: 2, axis: { units: f.units }, spec: { sampleSize: f.observations.length },
    retained: { kind: 'complete', values: [...f.observations] },
    series: {
      histogram: { kind: 'histogram', normalization: 'count', ...structuredClone(f.histogram) },
      ecdf: { kind: 'ecdf', scale: 'count', ...structuredClone(f.ecdf) },
    },
  };
}

for (const f of fixtures) {
  test(`AC1 hand-counted membership, ranks and right continuity: ${f.id}`, () => {
    const result = independentlyCount(f.observations, f.histogram.edges);
    assert.deepEqual(result.histogram, f.histogram);
    assert.deepEqual(result.ecdf, f.ecdf);
    for (const [x, expected] of f.queries) {
      assert.equal(result.countAt(x), expected);
      let actual = 0;
      result.ecdf.x.forEach((value, i) => { if (value <= x) actual = result.ecdf.cumulativeCounts[i]; });
      assert.equal(actual, expected);
    }
    assert.deepEqual(auditSnapshot(record(f), f), []);
  });
}

test('AC1 unequal-width density has inverse units and total-N visible area', () => {
  const f = byId('unequal-widths');
  const heights = f.histogram.counts.map((c, i) => c / (f.observations.length * (f.histogram.edges[i+1]-f.histogram.edges[i])));
  assert.deepEqual(heights, f.derived.densityTotalN);
  assert.deepEqual(f.histogram.counts.map(c => c/f.observations.length), f.derived.relativeCounts);
  assert.equal(heights.reduce((area, y, i) => area+y*(f.histogram.edges[i+1]-f.histogram.edges[i]), 0), f.derived.visibleProbability);
});

test('AC2 identical histogram totals do not hide incorrect membership', () => {
  const f = byId('unequal-widths');
  const bad = record(f);
  bad.series.histogram.counts = [4, 4];
  assert.equal(bad.series.histogram.counts.reduce((a,b) => a+b), 8);
  assert.deepEqual(auditSnapshot(bad, f), ['histogram-membership']);
});

test('AC2 strictly increasing ranks with the same final and summed totals are rejected separately', () => {
  const f = byId('unequal-widths');
  const bad = record(f);
  bad.series.ecdf.cumulativeCounts = [2, 3, 4, 5, 7, 8, 9, 10];
  const sum = values => values.reduce((a,b) => a+b);
  assert.equal(sum(bad.series.ecdf.cumulativeCounts), sum(f.ecdf.cumulativeCounts));
  assert.equal(bad.series.ecdf.cumulativeCounts.at(-1), f.observations.length);
  assert.ok(bad.series.ecdf.cumulativeCounts.every((n,i,a) => !i || n>a[i-1]));
  assert.deepEqual(auditSnapshot(bad, f), ['ecdf-ranks']);
});

test('AC2 altered ECDF coordinates are rejected even when all counts stay unchanged', () => {
  const f = byId('ties-final-edge');
  const bad = record(f);
  bad.series.ecdf.x[2] = 0.75;
  assert.deepEqual(auditSnapshot(bad, f), ['ecdf-support']);
});

test('AC2 underflow/overflow swaps and a dropped final edge are visible', () => {
  const f = byId('ties-final-edge');
  const bad = record(f);
  bad.series.histogram.counts[1]--;
  bad.series.histogram.overflow++;
  assert.deepEqual(auditSnapshot(bad, f), ['histogram-membership', 'histogram-overflow']);
  const outside = byId('all-outside');
  const shifted = record(outside);
  shifted.series.histogram.underflow = 1;
  shifted.series.histogram.overflow = 3;
  assert.deepEqual(auditSnapshot(shifted, outside), ['histogram-underflow', 'histogram-overflow']);
});

test('AC3 saved v2 JSON retains exact original precision, units and count labels', () => {
  assert.deepEqual(auditSnapshot(saved, byId('precision-near-edges')), []);
  const changed = structuredClone(saved);
  changed.retained.values = changed.retained.values.map(x => Number(x.toFixed(2)));
  assert.ok(auditSnapshot(changed, byId('precision-near-edges')).includes('retained-values'));
  for (const units of ['ms', null, undefined]) {
    const bad = structuredClone(saved);
    bad.axis.units = units;
    assert.deepEqual(auditSnapshot(bad, byId('precision-near-edges')), ['units']);
  }
});

test('AC3 v1 CSV preserves values/order but cannot independently prove units', () => {
  const result = auditCsv(csv, byId('precision-near-edges'), saved);
  assert.deepEqual(result.issues, ['csv-units-missing']);
  assert.deepEqual(result.values, byId('precision-near-edges').observations);
  const rounded = csv.replace('1.0000000000000002', '1');
  assert.ok(auditCsv(rounded, byId('precision-near-edges'), saved).issues.includes('csv-values'));
});

test('AC3 an explicitly unit-labelled CSV audits units independently', () => {
  const text = csv.trimEnd().split(/\r?\n/).map((line, i) => line+(i ? ',s' : ',units')).join('\r\n')+'\r\n';
  assert.deepEqual(auditCsv(text, byId('precision-near-edges'), saved).issues, []);
  assert.deepEqual(auditCsv(text.replace(',s\r\n', ',ms\r\n'), byId('precision-near-edges'), saved).issues, ['csv-units']);
});

test('AC3 CSV audit detects provenance, order, counts and type corruption', () => {
  const f = byId('precision-near-edges');
  const lf = csv.replaceAll('\r\n', '\n');
  const lines = lf.trimEnd().split('\n');
  for (const [text, code] of [
    [lf.replace('audit-precision,', 'other-record,'), 'csv-provenance'],
    [lf.replace(',17,', ',18,'), 'csv-provenance'],
    [[lines[0], lines[2], lines[1], ...lines.slice(3)].join('\n'), 'csv-order'],
    [lines.slice(0, -1).join('\n'), 'csv-length'],
    [lf.replace(',-5e-324', ','), 'csv-numeric'],
    [lf.replace(',-5e-324', ',NaN'), 'csv-numeric'],
    [lf.replace(',-5e-324', ',Infinity'), 'csv-numeric'],
  ]) assert.ok(auditCsv(text, f, saved).issues.includes(code), code);
});

test('independent CSV reader handles quoted newline/quote fields and rejects malformed columns', () => {
  const metadata = structuredClone(saved);
  metadata.id = 'audit,"precision"\nΩ';
  const quoted = csv.trimEnd().split(/\r?\n/).map((line, index) => {
    const cells = line.split(',');
    if (index) cells[0] = metadata.id;
    return cells.map(value => '"'+value.replaceAll('"', '""')+'"').join(',');
  }).join('\r\n')+'\r\n';
  assert.deepEqual(auditCsv(quoted, byId('precision-near-edges'), metadata).issues, ['csv-units-missing']);
  assert.deepEqual(auditCsv('"unterminated', byId('precision-near-edges'), saved).issues, ['csv-syntax']);
  assert.deepEqual(auditCsv(csv.replace(',value', ',draw'), byId('precision-near-edges'), saved).issues, ['csv-columns']);
});

test('invalid source inputs and false normalization labels fail explicitly', () => {
  for (const [values, edges] of [[[], [0,1]], [[NaN], [0,1]], [[Infinity], [0,1]], [[0], [1,1]], [[0], [1,0]], [[0], [0,Infinity]]]) {
    assert.throws(() => independentlyCount(values, edges), TypeError);
  }
  const f = byId('unequal-widths');
  const bad = record(f);
  bad.series.histogram.normalization = 'density';
  bad.series.ecdf.scale = 'fraction';
  assert.deepEqual(auditSnapshot(bad, f), ['histogram-normalization', 'ecdf-scale']);
  const wrongN = record(f); wrongN.spec.sampleSize++;
  assert.deepEqual(auditSnapshot(wrongN, f), ['sample-size']);
  const wrongEdges = record(f); wrongEdges.series.histogram.edges[1] = 2;
  assert.deepEqual(auditSnapshot(wrongEdges, f), ['histogram-edges']);
});
