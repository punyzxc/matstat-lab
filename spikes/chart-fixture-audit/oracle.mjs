// Disposable independent audit for #21. No application/codec/chart imports.
const finite = a => Array.isArray(a) && Array.from(a).every(x => typeof x === 'number' && Number.isFinite(x));
const same = (a, b) => Array.isArray(a) && a.length === b.length && b.every((v, i) => Object.is(a[i], v));

export function independentlyCount(observations, edges) {
  if (!finite(observations) || !observations.length || !finite(edges) || edges.length < 2
      || edges.some((x, i) => i > 0 && x <= edges[i-1])) throw new TypeError('invalid-reference-input');
  // Deliberately not the codec's sorted-array/running-rank algorithm.
  // Each bin and each ECDF abscissa is counted directly against original draws.
  const counts = edges.slice(1).map((right, i) => observations.filter(value =>
    value >= edges[i] && (value < right || (i === edges.length-2 && value === right))).length);
  const countAt = x => observations.filter(value => value <= x).length;
  const x = [...new Set(observations)].sort((a, b) => a-b);
  return {
    histogram: {
      edges: [...edges], counts,
      underflow: observations.filter(v => v < edges[0]).length,
      overflow: observations.filter(v => v > edges.at(-1)).length,
    },
    ecdf: { x, cumulativeCounts: x.map(countAt) },
    countAt,
  };
}

export function auditSnapshot(snapshot, fixture) {
  const issues = [];
  const expected = independentlyCount(fixture.observations, fixture.histogram.edges);
  if (snapshot?.schemaVersion !== 2) issues.push('schema-version');
  if (snapshot?.spec?.sampleSize !== fixture.observations.length) issues.push('sample-size');
  if (snapshot?.retained?.kind !== 'complete') issues.push('retention-kind');
  if (!same(snapshot?.retained?.values, fixture.observations)) issues.push('retained-values');
  if (snapshot?.axis?.units !== fixture.units) issues.push('units');
  const h = snapshot?.series?.histogram;
  const e = snapshot?.series?.ecdf;
  if (h?.kind !== 'histogram' || h?.normalization !== 'count') issues.push('histogram-normalization');
  if (!same(h?.edges, expected.histogram.edges)) issues.push('histogram-edges');
  if (!same(h?.counts, expected.histogram.counts)) issues.push('histogram-membership');
  if (h?.underflow !== expected.histogram.underflow) issues.push('histogram-underflow');
  if (h?.overflow !== expected.histogram.overflow) issues.push('histogram-overflow');
  if (e?.kind !== 'ecdf' || e?.scale !== 'count') issues.push('ecdf-scale');
  if (!same(e?.x, expected.ecdf.x)) issues.push('ecdf-support');
  if (!same(e?.cumulativeCounts, expected.ecdf.cumulativeCounts)) issues.push('ecdf-ranks');
  return issues;
}

// Small independent CSV parser for audit fixtures: quoted fields, escaped quotes,
// embedded newline, CRLF/LF. Not an application import/export implementation.
function parseCsv(text) {
  if (typeof text !== 'string' || !text.length) throw new TypeError('csv-syntax');
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  const pushField = () => { row.push(field); field = ''; closed = false; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i+1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === ',') pushField();
    else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i+1] === '\n') i++;
      pushRow();
    } else if (ch === '"' && !field && !closed) quoted = true;
    else {
      if (closed || ch === '"') throw new TypeError('csv-syntax');
      field += ch;
    }
  }
  if (quoted) throw new TypeError('csv-syntax');
  if (field || row.length || closed) pushRow();
  return rows;
}

export function auditCsv(text, fixture, expectedMetadata) {
  let rows;
  try { rows = parseCsv(text); } catch { return { issues: ['csv-syntax'], values: [] }; }
  const [header, ...data] = rows;
  const required = ['id', 'module', 'seed', 'rng_version', 'algorithm_version', 'draw', 'value'];
  if (!header || new Set(header).size !== header.length || required.some(key => !header.includes(key))
      || data.some(row => row.length !== header.length)) return { issues: ['csv-columns'], values: [] };
  const issues = [];
  const cell = (row, key) => row[header.indexOf(key)];
  const numeric = value => typeof value === 'string' && /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)
    && Number.isFinite(Number(value));
  const values = data.map(row => numeric(cell(row, 'value')) ? Number(cell(row, 'value')) : NaN);
  if (values.some(v => !Number.isFinite(v))) issues.push('csv-numeric');
  if (data.length !== fixture.observations.length) issues.push('csv-length');
  if (data.some((row, i) => cell(row, 'draw') !== String(i+1))) issues.push('csv-order');
  if (!same(values, fixture.observations)) issues.push('csv-values');
  const spec = expectedMetadata.spec;
  const provenance = { id: expectedMetadata.id, module: expectedMetadata.moduleId, seed: String(spec.seed),
    rng_version: spec.rngVersion, algorithm_version: spec.algorithmVersion };
  if (data.some(row => Object.entries(provenance).some(([key, value]) => cell(row, key) !== value))) issues.push('csv-provenance');
  if (!header.includes('units')) issues.push('csv-units-missing');
  else if (data.some(row => cell(row, 'units') !== fixture.units)) issues.push('csv-units');
  return { issues, values };
}
