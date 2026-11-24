// Throwaway Discovery spike for issue #29. Not product code.
// Snapshot version 2 = version 1 (spikes/explorer-chart) plus the fields that the
// comparison policy (spikes/comparison-compatibility) needs. Version 0 and 1
// records migrate deterministically; facts that v1 never stored become null
// ("unknown"), so a comparison refuses instead of guessing.
import { decode as decodeV1 } from '../explorer-chart/snapshot.mjs';

export const UNITS = new Set(['1', 's', 'min', 'h', 'cm', 'm', 'kg']); // '1' = dimensionless
export const NORMALIZATIONS = new Set(['count', 'relative', 'density']);
export const ECDF_SCALES = new Set(['count', 'fraction']);
export const VARIANCE_DIVISORS = new Set(['n', 'n-1', 'not-reported']);
export const QUANTILE_METHODS = new Set(['hf1', 'hf2', 'hf3', 'hf4', 'hf5', 'hf6', 'hf7', 'hf8', 'hf9', 'not-reported']);

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const nullOr = (v, set) => v === null || set.has(v);
const VARIANCE_KEYS = ['variance', 'sd', 'var', 'std'];
const QUANTILE_KEYS = ['median', 'q1', 'q3', 'iqr'];

/** v1 -> v2. Every new field is either derived from what v1 stored, or null. */
export function migrateV1(s) {
  const { histogram, ecdf } = s.series;
  const reports = keys => keys.some(k => k in s.observed);
  return {
    ...structuredClone(s),
    schemaVersion: 2,
    axis: { units: null }, // v1 never recorded units: unknown, not dimensionless
    series: {
      histogram: { kind: 'histogram', normalization: 'count', ...structuredClone(histogram) }, // v1 validates counts
      ecdf: { kind: 'ecdf', scale: 'count', ...structuredClone(ecdf) }, // v1 stores cumulativeCounts
    },
    statistics: {
      // If v1 reported no variance or quantile, the divisor or method was never used.
      varianceDenominator: reports(VARIANCE_KEYS) ? null : 'not-reported',
      quantileMethod: reports(QUANTILE_KEYS) ? null : 'not-reported',
    },
    migratedFrom: s.schemaVersion ?? 1,
  };
}

function validV2Fields(s) {
  const { axis, series, statistics } = s;
  if (!object(axis) || !nullOr(axis.units, UNITS)) return false;
  if (!object(series) || !object(series.histogram) || !object(series.ecdf)) return false;
  if (series.histogram.kind !== 'histogram' || !NORMALIZATIONS.has(series.histogram.normalization)) return false;
  if (series.ecdf.kind !== 'ecdf' || !ECDF_SCALES.has(series.ecdf.scale)) return false;
  if (!object(statistics)) return false;
  return nullOr(statistics.varianceDenominator, VARIANCE_DIVISORS) && nullOr(statistics.quantileMethod, QUANTILE_METHODS);
}

export function decode(input) {
  let data;
  try {
    data = typeof input === 'string' ? JSON.parse(input) : input;
  } catch {
    return { ok: false, code: 'invalid-snapshot' };
  }
  if (!object(data)) return { ok: false, code: 'invalid-snapshot' };
  if (data.schemaVersion === 2) {
    // Validate the shared v1 core by projecting v2 back onto it, then the new fields.
    const { axis, statistics, migratedFrom, ...core } = data;
    const v1 = {
      ...core,
      schemaVersion: 1,
      series: {
        histogram: stripKeys(data.series?.histogram, ['kind', 'normalization']),
        ecdf: stripKeys(data.series?.ecdf, ['kind', 'scale']),
      },
    };
    if (!decodeV1(v1).ok || !validV2Fields(data)) return { ok: false, code: 'invalid-snapshot' };
    return { ok: true, snapshot: data, migrated: false };
  }
  if (Number.isInteger(data.schemaVersion) && data.schemaVersion > 2) return { ok: false, code: 'unsupported-version' };
  const old = decodeV1(data);
  if (!old.ok) return old;
  return { ok: true, snapshot: migrateV1({ ...old.snapshot, schemaVersion: data.schemaVersion }), migrated: true };
}

function stripKeys(o, keys) {
  if (!object(o)) return o;
  const copy = { ...o };
  for (const k of keys) delete copy[k];
  return copy;
}

/** Projection into the view the #22 comparator reads. Null stays null. */
export function toComparisonView(s) {
  return {
    schemaVersion: 1, // the comparator's own view version, not the storage version
    moduleId: s.moduleId,
    model: s.spec.distribution,
    sampleSize: s.spec.sampleSize,
    seed: s.spec.seed,
    rngVersion: s.spec.rngVersion,
    algorithmVersion: s.spec.algorithmVersion,
    units: s.axis.units,
    seriesKind: 'histogram',
    statistics: s.statistics.varianceDenominator === null || s.statistics.quantileMethod === null ? null : s.statistics,
    histogram: {
      edges: s.series.histogram.edges,
      values: s.series.histogram.counts,
      underflow: s.series.histogram.underflow,
      overflow: s.series.histogram.overflow,
      normalization: s.series.histogram.normalization,
    },
    retained: s.retained,
  };
}
