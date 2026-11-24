// Throwaway Discovery spike for issue #29. Not product code.
// Snapshot version 2 = version 1 (spikes/explorer-chart) plus the fields that the
// comparison policy (spikes/comparison-compatibility) needs. Version 0 and 1
// records migrate deterministically; facts that v1 never stored become null
// ("unknown"), so a comparison refuses instead of guessing.
import { decode as decodeV1 } from '../explorer-chart/snapshot.mjs';

export const UNITS = new Set(['1', 's', 'min', 'h', 'cm', 'm', 'kg']); // '1' = dimensionless
// The shared v1 core validates integer counts against retained values, so this
// spike can only store count-scaled series truthfully. 'relative', 'density' and
// 'fraction' are reserved for series without retained data, which need their own
// validator (not built here).
export const NORMALIZATIONS = new Set(['count']);
export const ECDF_SCALES = new Set(['count']);
export const VARIANCE_DIVISORS = new Set(['n', 'n-1', 'not-reported']);
export const QUANTILE_METHODS = new Set(['hf1', 'hf2', 'hf3', 'hf4', 'hf5', 'hf6', 'hf7', 'hf8', 'hf9', 'not-reported']);

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const nullOr = (v, set) => v === null || set.has(v);
const onlyKeys = (o, keys) => Object.keys(o).every(k => keys.includes(k));

// Observed measures that involve neither a variance divisor nor a quantile method.
// Anything else in a v1 `observed` map might, so its definition becomes unknown.
const DEFINITION_FREE = new Set(['mean', 'min', 'max', 'n', 'sum', 'count']);

/** v1 -> v2. Every new field is either derived from what v1 stored, or null. */
export function migrateV1(s) {
  const usesDefinitions = Object.keys(s.observed).some(k => !DEFINITION_FREE.has(k));
  const { edges, counts, underflow, overflow } = s.series.histogram;
  const { x, cumulativeCounts } = s.series.ecdf;
  return {
    ...structuredClone(s),
    schemaVersion: 2,
    axis: { units: null }, // v1 never recorded units: unknown, not dimensionless
    series: {
      // Only the validated v1 fields are copied; the derived labels always win.
      histogram: { kind: 'histogram', normalization: 'count', edges: [...edges], counts: [...counts], underflow, overflow },
      ecdf: { kind: 'ecdf', scale: 'count', x: [...x], cumulativeCounts: [...cumulativeCounts] },
    },
    statistics: {
      varianceDenominator: usesDefinitions ? null : 'not-reported',
      quantileMethod: usesDefinitions ? null : 'not-reported',
    },
    migratedFrom: s.schemaVersion ?? 1,
  };
}

function validV2Fields(s) {
  const { axis, series, statistics } = s;
  if ('migratedFrom' in s && ![0, 1].includes(s.migratedFrom)) return false; // audit marker from migration
  if (!object(axis) || !onlyKeys(axis, ['units']) || !nullOr(axis.units, UNITS)) return false;
  if (!object(series) || !onlyKeys(series, ['histogram', 'ecdf'])) return false;
  const { histogram: h, ecdf: e } = series;
  if (!object(h) || !onlyKeys(h, ['kind', 'normalization', 'edges', 'counts', 'underflow', 'overflow'])) return false;
  if (!object(e) || !onlyKeys(e, ['kind', 'scale', 'x', 'cumulativeCounts'])) return false;
  if (h.kind !== 'histogram' || !NORMALIZATIONS.has(h.normalization)) return false;
  if (e.kind !== 'ecdf' || !ECDF_SCALES.has(e.scale)) return false;
  if (!object(statistics) || !onlyKeys(statistics, ['varianceDenominator', 'quantileMethod'])) return false;
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
    return { ok: true, snapshot: structuredClone(data), migrated: false };
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

/**
 * Projection into the view the #22 comparator reads, for one series kind.
 * Null stays null, and each statistic field is passed separately, so the
 * comparator names exactly which definition is missing.
 */
export function toComparisonView(s, seriesKind = 'histogram') {
  const h = s.series.histogram, e = s.series.ecdf;
  return {
    schemaVersion: 1, // the comparator's own view version, not the storage version
    moduleId: s.moduleId,
    model: s.spec.distribution,
    sampleSize: s.spec.sampleSize,
    seed: s.spec.seed,
    rngVersion: s.spec.rngVersion,
    algorithmVersion: s.spec.algorithmVersion,
    units: s.axis.units,
    seriesKind,
    statistics: { ...s.statistics },
    histogram: { edges: h.edges, values: h.counts, underflow: h.underflow, overflow: h.overflow, normalization: h.normalization },
    ecdf: { x: e.x, values: e.cumulativeCounts, scale: e.scale },
    retained: s.retained,
  };
}
