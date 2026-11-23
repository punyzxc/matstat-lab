export const storedRun = {
  schemaVersion: 1,
  id: 'experiment-001',
  name: 'Uniform observations',
  moduleId: 'distribution',
  finishedAt: 1795430400000,
  spec: {
    runId: 'run-001',
    distribution: { kind: 'uniform', params: { min: 0, max: 3 } },
    seed: 2048,
    sampleSize: 5,
    repetitions: 1,
    rngVersion: 'discovery-fixture',
    algorithmVersion: 'discovery-fixture',
  },
  execution: { durationMs: 12, status: 'completed', source: 'fixture' },
  observed: { mean: 1.1 },
  theory: { mean: 1.5 },
  warnings: ['OUTSIDE_PLOT_DOMAIN'],
  series: {
    histogram: { edges: [0, 1, 2], counts: [2, 2], underflow: 0, overflow: 1 },
    ecdf: { x: [0, 0.5, 1, 3], cumulativeCounts: [1, 2, 4, 5] },
  },
  retained: { kind: 'complete', values: [0, 0.5, 1, 1, 3] },
};

export function oldFixture() {
  const { finishedAt, ...fields } = structuredClone(storedRun);
  return { ...fields, schemaVersion: 0, completedAt: finishedAt };
}
