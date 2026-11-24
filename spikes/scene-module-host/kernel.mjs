// Contract fixture for the scene host (#37). Not a lecture station: it is reachable only at
// #station/contract-fixture and exists so tests can exercise a real kernel end to end.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';

export const meta = {
  id: 'scene-module-host',
  lectures: ['L1'],
  title: 'Contract fixture: frequency of an event with probability p',
  params: [
    { key: 'p', label: 'Probability p', min: 0, max: 1, step: 0.05, default: 0.3 },
    { key: 'n', label: 'Trials n', min: 100, max: 5000, step: 100, default: 1000 },
  ],
};

export function run({ p, n }, { seed }) {
  let hits = 0;
  const x = [], y = [];
  for (let i = 0; i < n; i++) {
    if (fixtureUint32(seed, 0, i) / 2 ** 32 < p) hits++;
    if ((i + 1) % 20 === 0 || i === n - 1) { x.push(i + 1); y.push(hits / (i + 1)); }
  }
  const half = 2 * Math.sqrt((p * (1 - p)) / n);
  return {
    axes: { x: 'trials k', y: 'relative frequency' },
    readouts: [
      { key: 'freq', label: 'Relative frequency m/n', observed: hits / n, theory: p },
      { key: 'hits', label: 'Hits m', observed: hits, theory: p * n },
    ],
    series: [
      { id: 'band', kind: 'band', tone: 'signal', label: 'p ± 2√(p(1−p)/k)', x, y: x.map((k) => p - 2 * Math.sqrt((p * (1 - p)) / k)), y2: x.map((k) => p + 2 * Math.sqrt((p * (1 - p)) / k)) },
      { id: 'freq', kind: 'line', label: 'm/k', x, y },
    ],
    notes: [`At n = ${n} the band half-width is ${half.toFixed(4)}.`],
  };
}
