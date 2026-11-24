// Throwaway Discovery spike for issue #22. Not product code.
// Decides whether two saved experiment views can share common axes in a
// sample-size comparison, and which meaning-preserving transforms are needed.

export const SUPPORTED_SCHEMA_VERSIONS = new Set([1]);

const SERIES_KINDS = new Set(['histogram', 'ecdf', 'pmf', 'pdf']);
const NORMALIZATIONS = new Set(['count', 'relative', 'density']);
const UNIT_FACTORS = { s: 1, min: 60, h: 3600 }; // observation-axis units with an exact linear map
const REQUIRED = ['schemaVersion', 'moduleId', 'model', 'sampleSize', 'seed', 'units', 'seriesKind', 'algorithmVersion', 'rngVersion', 'statistics'];

// Stored numbers are exact; a documented conversion may add rounding (relative 1e-12).
const close = (x, y) => x === y || Math.abs(x - y) <= 1e-12 * Math.max(Math.abs(x), Math.abs(y));
const sameArray = (a, b) => a.length === b.length && a.every((v, i) => close(v, b[i]));
const sameKeys = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Canonical parameters: exponential uses rate, normal uses standard deviation.
export function canonicalModel(model) {
  const params = { ...model.params };
  let converted = false;
  if (model.kind === 'exponential' && 'scale' in params) {
    params.rate = 1 / params.scale;
    delete params.scale;
    converted = true;
  }
  if (model.kind === 'normal' && 'variance' in params) {
    params.sd = Math.sqrt(params.variance);
    delete params.variance;
    converted = true;
  }
  return { kind: model.kind, params, converted };
}

// Power of the axis unit carried by each canonical parameter. A parameter that
// is not listed has no known dimension, so a unit change cannot be applied to it.
const UNIT_POWER = {
  uniform: { min: 1, max: 1 },
  normal: { mean: 1, sd: 1 },
  exponential: { rate: -1 },
};
function rescaleParams(model, factor) {
  if (factor === 1) return model;
  const powers = UNIT_POWER[model.kind] ?? {};
  const params = {};
  for (const [k, v] of Object.entries(model.params)) {
    if (!(k in powers)) return null;
    params[k] = v * factor ** powers[k];
  }
  return { ...model, params };
}

function sameParams(a, b) {
  const keys = Object.keys(a).sort();
  return sameKeys(keys, Object.keys(b).sort()) && keys.every(k => close(a[k], b[k]));
}

// Total n is the documented density denominator, including draws outside the domain.
export function toDensity(h, n) {
  if (!(Number.isSafeInteger(n) && n > 0)) throw new RangeError('n must be a positive integer');
  const widths = h.edges.slice(1).map((e, i) => e - h.edges[i]);
  if (h.normalization === 'density') return h.values.slice();
  if (h.normalization === 'relative') return h.values.map((v, i) => v / widths[i]);
  return h.values.map((c, i) => c / (n * widths[i]));
}

// Exact coarsening: every coarse edge is a fine edge and the outer edges agree.
export function mergeCounts(fine, coarseEdges) {
  const idx = coarseEdges.map(e => fine.edges.findIndex(f => close(f, e)));
  if (idx.some(i => i < 0) || idx[0] !== 0 || idx[idx.length - 1] !== fine.edges.length - 1) return null;
  return idx.slice(1).map((end, k) => fine.values.slice(idx[k], end).reduce((s, v) => s + v, 0));
}

export function rebin(values, edges) {
  if (!Array.isArray(edges) || edges.length < 2) throw new RangeError('at least two edges are required');
  const counts = new Array(edges.length - 1).fill(0);
  let underflow = 0, overflow = 0, invalid = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) { invalid++; continue; }
    if (v < edges[0]) { underflow++; continue; }
    const last = edges[edges.length - 1];
    if (v > last) { overflow++; continue; }
    let i = edges.findIndex((e, k) => k > 0 && (v < e || (k === edges.length - 1 && v === e))) - 1;
    counts[i]++;
  }
  return { edges: edges.slice(), values: counts, underflow, overflow, invalid, normalization: 'count' };
}

function checkMetadata(view, side, out) {
  for (const key of REQUIRED) if (view[key] == null) out.reasons.push(`missing-metadata:${key}@${side}`);
  for (const key of ['varianceDenominator', 'quantileMethod']) {
    if (view.statistics != null && view.statistics[key] == null) out.reasons.push(`missing-metadata:statistics.${key}@${side}`);
  }
  if (view.seriesKind === 'histogram' && view.histogram == null) out.reasons.push(`missing-metadata:histogram@${side}`);
}

export function compare(a, b) {
  const out = { decision: 'compatible', reasons: [], transforms: [], warnings: [] };
  const fail = code => { out.reasons.push(code); return out; };
  const done = () => {
    out.decision = out.reasons.length ? 'incompatible' : out.transforms.length ? 'compatible-after-transform' : 'compatible';
    return out;
  };

  checkMetadata(a, 'a', out);
  checkMetadata(b, 'b', out);
  if (out.reasons.length) return done();

  if (![a, b].every(v => SUPPORTED_SCHEMA_VERSIONS.has(v.schemaVersion))) {
    fail('unsupported-schema-version');
    return done();
  }
  if (a.moduleId !== b.moduleId) fail('module-mismatch');
  if (a.algorithmVersion !== b.algorithmVersion) fail('algorithm-version-mismatch');

  // Both sides are expressed in the base unit of the table, so the result does
  // not depend on argument order.
  let fa = 1, fb = 1;
  if (a.units !== b.units) {
    if (a.units in UNIT_FACTORS && b.units in UNIT_FACTORS) {
      fa = UNIT_FACTORS[a.units];
      fb = UNIT_FACTORS[b.units];
      out.transforms.push('rescale-units');
    } else fail('unit-mismatch');
  }

  const ma = rescaleParams(canonicalModel(a.model), fa), mb = rescaleParams(canonicalModel(b.model), fb);
  if (!ma || !mb) fail('parameter-unit-unknown');
  else if (ma.kind !== mb.kind) fail('model-mismatch');
  else if (!sameParams(ma.params, mb.params)) fail('parameter-mismatch');
  else if (ma.converted || mb.converted) out.transforms.push(`reparametrize:${ma.kind}`);

  if (!SERIES_KINDS.has(a.seriesKind) || a.seriesKind !== b.seriesKind) fail('series-kind-mismatch');

  // Statistic definitions shown next to the plot.
  const sa = a.statistics, sb = b.statistics;
  if (sa.varianceDenominator !== sb.varianceDenominator) {
    if (Math.min(a.sampleSize, b.sampleSize) < 2) fail('variance-undefined-at-n1');
    else out.transforms.push('variance-denominator:n<->n-1');
  }
  if (sa.quantileMethod !== sb.quantileMethod) {
    if (a.retained?.kind === 'complete' && b.retained?.kind === 'complete') out.transforms.push('recompute-quantiles');
    else fail('quantile-method-mismatch');
  }

  if (out.reasons.length) return done();

  if (a.seriesKind === 'histogram') compareHistograms(a, b, fa, fb, out);
  if (a.seriesKind === 'ecdf') {
    const scales = [a.ecdf?.scale, b.ecdf?.scale];
    if (!scales.every(s => s === 'count' || s === 'fraction')) out.reasons.push('unknown-ecdf-scale');
    else if (scales.includes('count') && (a.sampleSize !== b.sampleSize || scales[0] !== scales[1])) {
      out.transforms.push('normalize-ecdf'); // cumulativeCounts / n
    }
  }

  if (a.sampleSize === b.sampleSize) out.warnings.push('same-sample-size');
  if (a.seed === b.seed && a.rngVersion === b.rngVersion && a.sampleSize !== b.sampleSize) out.warnings.push('shared-seed-prefix');
  if (a.rngVersion !== b.rngVersion) out.warnings.push('different-rng-streams');
  return done();
}

function compareHistograms(a, b, fa, fb, out) {
  for (const h of [a.histogram, b.histogram]) {
    if (!NORMALIZATIONS.has(h.normalization)) return out.reasons.push('unknown-normalization');
    if (!Array.isArray(h.edges) || h.edges.length < 2 || !h.edges.every(Number.isFinite)) return out.reasons.push('invalid-histogram-edges');
  }
  const scale = (h, f) => (f === 1 ? h : { ...h, edges: h.edges.map(e => e * f) });
  const ha = scale(a.histogram, fa), hb = scale(b.histogram, fb);
  let edges = ha.edges;
  let rebinned = false;

  if (!sameArray(ha.edges, hb.edges)) {
    const countsOnly = ha.normalization === 'count' && hb.normalization === 'count';
    const mergedB = countsOnly ? mergeCounts(hb, ha.edges) : null;
    const mergedA = countsOnly ? mergeCounts(ha, hb.edges) : null;
    if (mergedB || mergedA) {
      out.transforms.push('merge-bins');
      edges = mergedB ? ha.edges : hb.edges;
    } else if (a.retained?.kind === 'complete' && b.retained?.kind === 'complete') {
      out.transforms.push('rebin-from-retained');
      rebinned = true; // rebinning yields counts again
    } else {
      return out.reasons.push('histogram-domain-mismatch');
    }
  }

  const densityNeeded = rebinned || ha.normalization !== hb.normalization ||
    (a.sampleSize !== b.sampleSize && ha.normalization === 'count');
  if (densityNeeded) out.transforms.push('normalize-density');
  // A density has units of 1/axis-unit, so its heights change with the axis unit.
  if (fa !== fb && (densityNeeded || ha.normalization === 'density')) out.transforms.push('rescale-density-heights');
  if (ha.underflow + ha.overflow + hb.underflow + hb.overflow > 0) out.warnings.push('mass-outside-domain');
  out.commonEdges = edges.slice();
}
