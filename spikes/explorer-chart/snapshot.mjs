const modules = new Set(['distribution', 'convergence', 'estimation', 'confidence', 'testing', 'randomness']);
const models = new Set(['uniform', 'normal', 'exponential', 'bernoulli', 'binomial', 'poisson']);
const token = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value);
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const object = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const finiteMap = value => object(value) && Object.values(value).every(Number.isFinite);
const ascends = values => values.every((value, i) => i === 0 || value > values[i - 1]);
const numericArray = value => Array.isArray(value) && value.length <= 4097 && Array.from(value).every(Number.isFinite);

function validSpec(spec) {
  return object(spec) && token(spec.runId) &&
    object(spec.distribution) && models.has(spec.distribution.kind) && finiteMap(spec.distribution.params) &&
    integer(spec.seed, 0, 0xffffffff) && integer(spec.sampleSize, 1, 4096) &&
    spec.repetitions === 1 && token(spec.rngVersion) && token(spec.algorithmVersion);
}

function validSeries(series, values) {
  if (!object(series) || !object(series.histogram) || !object(series.ecdf)) return false;
  const { histogram, ecdf } = series;
  const { edges, counts, underflow, overflow } = histogram;
  const { x, cumulativeCounts } = ecdf;
  if (!numericArray(edges) || edges.length < 2 || !ascends(edges) || !numericArray(counts) ||
      counts.length !== edges.length - 1 || !numericArray(x) || !ascends(x) ||
      !numericArray(cumulativeCounts) || cumulativeCounts.length !== x.length) return false;
  const sorted = values.slice().sort((a, b) => a - b);
  let rank = 0;
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== sorted[rank]) return false;
    while (rank < sorted.length && sorted[rank] === x[i]) rank++;
    if (cumulativeCounts[i] !== rank) return false;
  }
  if (rank !== sorted.length) return false;
  rank = 0;
  while (rank < sorted.length && sorted[rank] < edges[0]) rank++;
  if (rank !== underflow) return false;
  for (let i = 0; i < counts.length; i++) {
    const start = rank, edge = edges[i + 1];
    const lastBin = i === counts.length - 1;
    while (rank < sorted.length && (sorted[rank] < edge || (lastBin && sorted[rank] === edge))) rank++;
    if (counts[i] !== rank - start) return false;
  }
  return overflow === sorted.length - rank;
}

function validSnapshot(value) {
  const { id, name, moduleId, finishedAt, spec, execution, observed, theory, warnings, series, retained } = value;
  return token(id) && typeof name === 'string' && name.trim().length > 0 && name.length <= 120 &&
    modules.has(moduleId) && integer(finishedAt, 0, 8640000000000000) && validSpec(spec) &&
    object(execution) && execution.status === 'completed' && integer(execution.durationMs, 0, 86400000) &&
    ['fixture', 'simulation'].includes(execution.source) && finiteMap(observed) && finiteMap(theory) &&
    Array.isArray(warnings) && warnings.length <= 32 && warnings.every(token) &&
    object(retained) && retained.kind === 'complete' && numericArray(retained.values) &&
    retained.values.length === spec.sampleSize && validSeries(series, retained.values);
}

export function decode(input) {
  let data;
  try {
    data = typeof input === 'string' ? JSON.parse(input) : input;
  } catch {
    return { ok: false, code: 'invalid-snapshot' };
  }
  if (!object(data)) return { ok: false, code: 'invalid-snapshot' };
  if (Number.isInteger(data.schemaVersion) && ![0, 1].includes(data.schemaVersion)) {
    return { ok: false, code: 'unsupported-version' };
  }
  if (data.schemaVersion === 0) {
    const { completedAt, ...fields } = data;
    data = { ...fields, schemaVersion: 1, finishedAt: completedAt };
  }
  if (data.schemaVersion !== 1 || !validSnapshot(data)) return { ok: false, code: 'invalid-snapshot' };
  return { ok: true, snapshot: data };
}

export function requireSnapshot(input) {
  const decoded = decode(input);
  if (!decoded.ok) throw new TypeError(decoded.code);
  return decoded.snapshot;
}

export function exportJson(input) {
  return JSON.stringify(requireSnapshot(input), null, 2) + '\n';
}

export function exportCsv(input) {
  const { id, moduleId, spec, retained } = requireSnapshot(input);
  const fixed = [id, moduleId, spec.seed, spec.rngVersion, spec.algorithmVersion];
  const rows = retained.values.map((value, i) => [...fixed, i + 1, value].join(','));
  return ['id,module,seed,rng_version,algorithm_version,draw,value', ...rows].join('\r\n') + '\r\n';
}

export function report(input) {
  const { id, moduleId, finishedAt, spec, observed, theory, warnings, retained, execution } = requireSnapshot(input);
  return structuredClone({
    reportVersion: 1, id, moduleId, finishedAt, spec, execution, observed, theory, warnings,
    totalDraws: spec.sampleSize, savedDraws: retained.values.length,
  });
}
