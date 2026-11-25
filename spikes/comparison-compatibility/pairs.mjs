// Fixture snapshot views and the expected decision for each pair.
// Expected decisions were written from the policy table in
// docs/research/comparison-compatibility.md before running compare.mjs.

const base = {
  schemaVersion: 1,
  moduleId: 'distribution',
  model: { kind: 'uniform', params: { min: 0, max: 3 } },
  sampleSize: 5,
  seed: 2048,
  rngVersion: 'discovery-fixture',
  algorithmVersion: 'discovery-fixture',
  units: '1',
  seriesKind: 'histogram',
  statistics: { varianceDenominator: 'n-1', quantileMethod: 'hf7' },
  histogram: { edges: [0, 1, 2, 3], values: [2, 2, 1], underflow: 0, overflow: 0, normalization: 'count' },
  retained: { kind: 'complete', values: [0, 0.5, 1, 1, 3] },
};

const view = patch => ({ ...structuredClone(base), ...structuredClone(patch) });

export const pairs = [
  {
    id: 'P01-only-n-differs',
    a: base,
    b: view({ sampleSize: 10, seed: 7, histogram: { edges: [0, 1, 2, 3], values: [3, 4, 3], underflow: 0, overflow: 0, normalization: 'count' }, retained: { kind: 'aggregate' } }),
    expect: { decision: 'compatible-after-transform', transforms: ['normalize-density'] },
  },
  {
    id: 'P02-only-n-differs-already-density',
    a: view({ histogram: { edges: [0, 1, 2, 3], values: [0.4, 0.4, 0.2], underflow: 0, overflow: 0, normalization: 'density' } }),
    b: view({ sampleSize: 10, seed: 7, histogram: { edges: [0, 1, 2, 3], values: [0.3, 0.4, 0.3], underflow: 0, overflow: 0, normalization: 'density' } }),
    expect: { decision: 'compatible', transforms: [] },
  },
  {
    id: 'P03-fine-bins-merge-exactly',
    a: base,
    b: view({ sampleSize: 6, seed: 9, histogram: { edges: [0, 0.5, 1, 1.5, 2, 2.5, 3], values: [1, 1, 1, 1, 1, 1], underflow: 0, overflow: 0, normalization: 'count' }, retained: { kind: 'aggregate' } }),
    expect: { decision: 'compatible-after-transform', transforms: ['merge-bins', 'normalize-density'] },
  },
  {
    id: 'P04-shifted-bins-no-raw-data',
    a: view({ retained: { kind: 'aggregate' } }),
    b: view({ sampleSize: 8, seed: 9, histogram: { edges: [0.25, 1.25, 2.25, 3.25], values: [3, 3, 2], underflow: 0, overflow: 0, normalization: 'count' }, retained: { kind: 'aggregate' } }),
    expect: { decision: 'incompatible', reasons: ['histogram-domain-mismatch'] },
  },
  {
    id: 'P05-shifted-bins-with-raw-data',
    a: base,
    b: view({ sampleSize: 4, seed: 9, histogram: { edges: [0.25, 1.25, 2.25, 3.25], values: [1, 2, 1], underflow: 0, overflow: 0, normalization: 'count' }, retained: { kind: 'complete', values: [0.5, 1.5, 2, 3] } }),
    expect: { decision: 'compatible-after-transform', transforms: ['rebin-from-retained', 'normalize-density'] },
  },
  {
    id: 'P06-different-parameter',
    a: base,
    b: view({ sampleSize: 10, model: { kind: 'uniform', params: { min: 0, max: 4 } } }),
    expect: { decision: 'incompatible', reasons: ['parameter-mismatch'] },
  },
  {
    id: 'P07-exponential-rate-vs-scale',
    a: view({ model: { kind: 'exponential', params: { rate: 0.5 } } }),
    b: view({ sampleSize: 10, seed: 7, model: { kind: 'exponential', params: { scale: 2 } } }),
    expect: { decision: 'compatible-after-transform', transforms: ['reparametrize:exponential', 'normalize-density'] },
  },
  {
    id: 'P08-minutes-vs-seconds',
    a: view({ units: 's', model: { kind: 'exponential', params: { rate: 0.5 } }, histogram: { edges: [0, 60, 120], values: [4, 1], underflow: 0, overflow: 0, normalization: 'count' } }),
    b: view({ units: 'min', sampleSize: 10, seed: 7, model: { kind: 'exponential', params: { rate: 30 } }, histogram: { edges: [0, 1, 2], values: [10, 0], underflow: 0, overflow: 0, normalization: 'count' } }),
    expect: { decision: 'compatible-after-transform', transforms: ['rescale-units', 'normalize-density', 'rescale-density-heights'] },
    note: '0.5 per second equals 30 per minute, so the model is the same after the unit map.',
  },
  {
    id: 'P08b-same-number-different-units',
    a: view({ units: 's', model: { kind: 'exponential', params: { rate: 0.5 } } }),
    b: view({ units: 'min', sampleSize: 10, seed: 7, model: { kind: 'exponential', params: { rate: 0.5 } } }),
    expect: { decision: 'incompatible', reasons: ['parameter-mismatch'] },
  },
  {
    id: 'P08c-unmapped-units',
    a: view({ units: 'cm' }),
    b: view({ units: 's', sampleSize: 10, seed: 7 }),
    expect: { decision: 'incompatible', reasons: ['unit-mismatch'] },
  },
  {
    id: 'P09-variance-divisor-differs',
    a: base,
    b: view({ sampleSize: 10, seed: 7, statistics: { varianceDenominator: 'n', quantileMethod: 'hf7' } }),
    expect: { decision: 'compatible-after-transform', transforms: ['variance-denominator:n<->n-1', 'normalize-density'] },
  },
  {
    id: 'P10-variance-divisor-at-n1',
    a: view({ sampleSize: 1, retained: { kind: 'complete', values: [1] }, histogram: { edges: [0, 1, 2, 3], values: [0, 1, 0], underflow: 0, overflow: 0, normalization: 'count' } }),
    b: view({ sampleSize: 10, seed: 7, statistics: { varianceDenominator: 'n', quantileMethod: 'hf7' } }),
    expect: { decision: 'incompatible', reasons: ['variance-undefined-at-n1'] },
  },
  {
    id: 'P11-quantile-method-differs-no-raw',
    a: view({ retained: { kind: 'aggregate' } }),
    b: view({ sampleSize: 10, seed: 7, statistics: { varianceDenominator: 'n-1', quantileMethod: 'hf6' }, retained: { kind: 'aggregate' } }),
    expect: { decision: 'incompatible', reasons: ['quantile-method-mismatch'] },
  },
  {
    id: 'P12-pmf-vs-pdf',
    a: view({ seriesKind: 'pmf', model: { kind: 'poisson', params: { lambda: 2 } } }),
    b: view({ seriesKind: 'pdf', sampleSize: 10, model: { kind: 'poisson', params: { lambda: 2 } } }),
    expect: { decision: 'incompatible', reasons: ['series-kind-mismatch'] },
  },
  {
    id: 'P13-future-schema',
    a: base,
    b: view({ schemaVersion: 2, sampleSize: 10 }),
    expect: { decision: 'incompatible', reasons: ['unsupported-schema-version'] },
  },
  {
    id: 'P14-algorithm-version-differs',
    a: base,
    b: view({ sampleSize: 10, algorithmVersion: 'engine-2' }),
    expect: { decision: 'incompatible', reasons: ['algorithm-version-mismatch'] },
  },
  {
    id: 'P15-missing-units',
    a: base,
    b: (() => { const v = view({ sampleSize: 10 }); delete v.units; return v; })(),
    expect: { decision: 'incompatible', reasons: ['missing-metadata:units@b'] },
  },
  {
    id: 'P16-same-seed-nested-prefix',
    a: base,
    b: view({ sampleSize: 10, histogram: { edges: [0, 1, 2, 3], values: [3, 4, 3], underflow: 0, overflow: 0, normalization: 'count' }, retained: { kind: 'aggregate' } }),
    expect: { decision: 'compatible-after-transform', transforms: ['normalize-density'], warnings: ['shared-seed-prefix'] },
  },
  {
    id: 'P17-ecdf-counts-only-n-differs',
    a: view({ seriesKind: 'ecdf', ecdf: { scale: 'count' } }),
    b: view({ seriesKind: 'ecdf', sampleSize: 10, seed: 7, ecdf: { scale: 'count' } }),
    expect: { decision: 'compatible-after-transform', transforms: ['normalize-ecdf'] },
  },
  {
    id: 'P18-ecdf-fractions-only-n-differs',
    a: view({ seriesKind: 'ecdf', ecdf: { scale: 'fraction' } }),
    b: view({ seriesKind: 'ecdf', sampleSize: 10, seed: 7, ecdf: { scale: 'fraction' } }),
    expect: { decision: 'compatible', transforms: [] },
  },
];
