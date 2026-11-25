// Station template (#99): copy this folder to spikes/<your-kernel>/, rename, and follow
// docs/research/station-authoring.md. A toy but complete kernel: two dice, their sum, and the joint law in 3D.
// It touches no DOM and uses no Math.random: the same params and seed always give the same bytes.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';

const NAMESPACE = 0x7e57; // your own constant keeps these streams apart from other kernels sharing a seed
const die = (seed, stream, i) => 1 + (fixtureUint32(seed, stream, i, NAMESPACE) % 6);

/** Parameters: the host draws a slider plus a typed box for each, or a row of chips for "(0 a, 1 b)" labels. */
const params = [
  { key: 'mode', label: 'Show (0 the sum $X_1 + X_2$, 1 the maximum $\\max(X_1, X_2)$)', min: 0, max: 1, step: 1, default: 0 },
  { key: 'n', label: 'Rolls $n$', min: 60, max: 20000, step: 60, default: 600 },
];

export const meta = {
  id: 'station-template',
  lectures: ['L5'],
  title: 'Template: the sum and the maximum of two dice',
  params,
};
// One kernel may serve several stations; each id is a catalog station id. `live` re-runs on every slider move.
export const stations = { 'dice-template': { params, live: true } };

/** Exact law of the sum (2…12) or the maximum (1…6) of two fair dice. */
export function exactLaw(mode) {
  const values = mode === 0 ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6];
  const p = values.map((v) => (mode === 0 ? (6 - Math.abs(v - 7)) / 36 : (2 * v - 1) / 36));
  return { values, p };
}

export function run({ mode = 0, n = 600 }, { seed = 1 } = {}) {
  const s = seed >>> 0;
  const { values, p } = exactLaw(mode);
  const counts = values.map(() => 0), joint = Array.from({ length: 6 }, () => new Array(6).fill(0));
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = die(s, 1, i), b = die(s, 2, i), v = mode === 0 ? a + b : Math.max(a, b);
    counts[values.indexOf(v)]++;
    joint[b - 1][a - 1]++;
    total += v;
  }
  const mean = values.reduce((m, v, k) => m + v * p[k], 0);
  const faces = [1, 2, 3, 4, 5, 6];
  return {
    axes: { x: mode === 0 ? 'sum $x_1 + x_2$' : 'maximum $\\max(x_1, x_2)$', y: 'probability' },
    readouts: [
      { key: 'mean', label: 'Mean $\\bar{x}$ against $M(X)$', observed: total / n, theory: mean, convention: `$n = ${n}$ rolls` },
      { key: 'top', label: mode === 0 ? '$P(X_1 + X_2 = 7)$' : '$P(\\max = 6)$', observed: counts[5] / n /* index 5: the sum 7 or the maximum 6 */, theory: mode === 0 ? 6 / 36 : 11 / 36 },
    ],
    series: [
      { id: 'sample', kind: 'pmf', tone: 'default', label: 'relative frequencies', x: values, y: counts.map((c) => c / n) },
      { id: 'exact', kind: 'pmf', tone: 'signal', label: mode === 0 ? '$P(X_1 + X_2 = k) = \\dfrac{6 - |k - 7|}{36}$' : '$P(\\max = k) = \\dfrac{2k - 1}{36}$', x: values, y: p },
    ],
    notes: [
      'Every number on this card comes from the seeded rolls or from the exact law: nothing is decorative.',
      'The 3D view shows the joint law of $(X_1, X_2)$: a flat table at $\\tfrac{1}{36}$ with the observed shares as stems.',
    ],
    surface: {
      x: faces, y: faces,
      z: faces.map(() => faces.map(() => 1 / 36)),
      zSample: joint.map((row) => row.map((c) => c / n)),
      labels: { x: '$x_1$', y: '$x_2$', z: 'probability' },
      title: 'Joint law of two fair dice: $P(X_1 = i, X_2 = j) = \\tfrac{1}{36}$',
      sampleLabel: 'Observed share of each pair',
    },
  };
}
