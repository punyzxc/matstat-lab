import assert from 'node:assert/strict';
import test from 'node:test';
import { storedRun, oldFixture } from '../explorer-chart/fixture.mjs';
import { decode, migrateV1, toComparisonView } from './snapshot-v2.mjs';
import { compare } from '../comparison-compatibility/compare.mjs';

// A record written natively in version 2, with every comparison field known.
const v2 = () => ({
  ...structuredClone(storedRun),
  schemaVersion: 2,
  axis: { units: '1' },
  series: {
    histogram: { kind: 'histogram', normalization: 'count', ...structuredClone(storedRun.series.histogram) },
    ecdf: { kind: 'ecdf', scale: 'count', ...structuredClone(storedRun.series.ecdf) },
  },
  statistics: { varianceDenominator: 'not-reported', quantileMethod: 'not-reported' },
});

test('a native version 2 record decodes unchanged', () => {
  assert.deepEqual(decode(JSON.stringify(v2())), { ok: true, snapshot: v2(), migrated: false });
});

test('version 1 migrates: derivable fields are filled, units stay unknown', () => {
  const r = decode(storedRun);
  assert.equal(r.ok, true);
  assert.equal(r.migrated, true);
  assert.equal(r.snapshot.schemaVersion, 2);
  assert.equal(r.snapshot.migratedFrom, 1);
  assert.equal(r.snapshot.axis.units, null);
  assert.equal(r.snapshot.series.histogram.normalization, 'count');
  assert.equal(r.snapshot.series.ecdf.scale, 'count');
  // The fixture reports only a mean: no divisor or quantile method was used.
  assert.deepEqual(r.snapshot.statistics, { varianceDenominator: 'not-reported', quantileMethod: 'not-reported' });
});

test('version 0 migrates through version 1 without mutating the input', () => {
  const old = oldFixture();
  const r = decode(old);
  assert.equal(r.ok, true);
  assert.equal(r.snapshot.migratedFrom, 0);
  assert.equal(old.schemaVersion, 0);
  assert.equal('axis' in old, false);
});

test('a version 1 record that reports a variance gets an unknown divisor', () => {
  const rec = structuredClone(storedRun);
  rec.observed.variance = 1.3;
  assert.equal(migrateV1(rec).statistics.varianceDenominator, null);
});

test('future versions are unsupported and corrupt version 2 records are invalid', () => {
  assert.equal(decode({ ...v2(), schemaVersion: 3 }).code, 'unsupported-version');
  for (const mutate of [
    r => { r.axis.units = 'parsec'; },
    r => { delete r.axis; },
    r => { r.series.histogram.normalization = 'percent'; },
    r => { r.series.ecdf.kind = 'pmf'; },
    r => { r.statistics.quantileMethod = 'hf10'; },
    r => { r.series.histogram.counts = [1, 3]; }, // the shared v1 core is still validated
  ]) {
    const bad = v2();
    mutate(bad);
    assert.equal(decode(bad).code, 'invalid-snapshot');
  }
});

// Expected decisions, written before running the comparator.
test('comparison never guesses: a migrated record without units is incompatible', () => {
  const migrated = toComparisonView(decode(storedRun).snapshot);
  const native = toComparisonView({ ...v2(), spec: { ...v2().spec, seed: 7 } });
  const got = compare(migrated, native);
  assert.equal(got.decision, 'incompatible');
  assert.ok(got.reasons.includes('missing-metadata:units@a'));
});

test('two native version 2 records that differ only in seed compare without transforms', () => {
  const a = toComparisonView(v2());
  const b = toComparisonView({ ...v2(), spec: { ...v2().spec, seed: 7 } });
  const got = compare(a, b);
  assert.equal(got.decision, 'compatible');
  assert.ok(got.warnings.includes('same-sample-size'));
});

test('an unknown statistic definition blocks the comparison', () => {
  const rec = structuredClone(storedRun);
  rec.observed.variance = 1.3;
  const migrated = migrateV1(rec);
  migrated.axis.units = '1'; // even with units known
  const got = compare(toComparisonView(migrated), toComparisonView(v2()));
  assert.equal(got.decision, 'incompatible');
  assert.ok(got.reasons.includes('missing-metadata:statistics.varianceDenominator@a'));
});

// Regressions from an independent check of the first draft.
test("labels that the stored counts cannot back are rejected", () => {
  for (const mutate of [
    r => { r.series.histogram.normalization = "density"; },
    r => { r.series.ecdf.scale = "fraction"; },
    r => { r.series.histogram.values = [1]; },
    r => { r.axis.note = "x"; },
    r => { r.statistics.extra = 1; },
    r => { r.migratedFrom = "banana"; },
    r => { r.migratedFrom = 2; },
  ]) {
    const bad = v2();
    mutate(bad);
    assert.equal(decode(bad).code, "invalid-snapshot");
  }
});

test("migration labels always win over stray v1 keys", () => {
  const rec = structuredClone(storedRun);
  Object.assign(rec.series.histogram, { kind: "pmf", normalization: "percent" });
  rec.series.ecdf.scale = "fraction";
  const r = decode(rec);
  assert.equal(r.ok, true);
  assert.equal(r.snapshot.series.histogram.kind, "histogram");
  assert.equal(r.snapshot.series.histogram.normalization, "count");
  assert.equal(r.snapshot.series.ecdf.scale, "count");
  assert.equal(decode(r.snapshot).ok, true);
});

test("any observed measure that may use a definition makes it unknown", () => {
  for (const key of ["standardDeviation", "stdev", "p25", "percentile95", "quantile50"]) {
    const rec = structuredClone(storedRun);
    rec.observed[key] = 1;
    assert.equal(migrateV1(rec).statistics.quantileMethod, null, key);
  }
});

test("decoded version 2 records are copies of the input", () => {
  const input = v2();
  const r = decode(input);
  r.snapshot.axis.units = "s";
  assert.equal(input.axis.units, "1");
});

test("the ECDF series can be compared through the same view", () => {
  const got = compare(toComparisonView(v2(), "ecdf"), toComparisonView({ ...v2(), spec: { ...v2().spec, seed: 7 } }, "ecdf"));
  assert.equal(got.decision, "compatible");
});

test("a migrated record survives a JSON round trip and keeps its audit marker", () => {
  const migrated = decode(storedRun).snapshot;
  const again = decode(JSON.stringify(migrated));
  assert.equal(again.ok, true);
  assert.equal(again.migrated, false);
  assert.equal(again.snapshot.migratedFrom, 1);
  assert.deepEqual(again.snapshot, migrated);
});
