// Lecture kernel for L1 and L4: the statistical definition of probability (Frequency) and the
// geometric method with the sin² example, a region in the unit square and the Bertrand paradox (Darts).
// Pure ES module: no DOM. Randomness only from fixtureUint32 (fixture-mix32-v1).
// Contract: docs/research/lecture-module-map.md; research: docs/research/lecture-geometric-probability.md.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';

/** Uniform on (0, 1), never 0 or 1, from one counter-based draw. */
const uni = (seed, stream, i) => (fixtureUint32(seed, stream, i) + 0.5) / 2 ** 32;
const r6 = (v) => (v == null || !Number.isFinite(v) ? null : Number(v.toPrecision(6)));
const fmt = (v, d = 4) => Number(v).toFixed(d);
const grid = (lo, hi, count) => Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));
/** Log-spaced checkpoints 1 … N (distinct integers), for running-frequency curves. */
export const checkpoints = (N, count = 120) => [...new Set(grid(0, Math.log(N), count).map((t) => Math.round(Math.exp(t))))];
/** Half-width of the predeclared band: 3 binomial standard errors. */
export const band3 = (p, n) => 3 * Math.sqrt((p * (1 - p)) / n);

// ---------------------------------------------------------------- Frequency station (L1, statistical definition)
const PATHS = 5;
/**
 * `paths` independent sequences of N trials of an event with probability p. Trial i of path j is a hit when
 * uni(seed, 10 + j, i) < p. Returns, per path, the running hit counts at the checkpoints.
 */
export function frequencyRuns(p, N, seed, paths = PATHS) {
  const ns = checkpoints(N);
  const counts = [];
  for (let j = 0; j < paths; j++) {
    let c = 0, k = 0;
    const row = [];
    for (let i = 1; i <= N; i++) {
      if (uni(seed, 10 + j, i) < p) c++;
      if (i === ns[k]) { row.push(c); k++; }
    }
    counts.push(row);
  }
  return { ns, counts };
}

function runFrequency({ p, N }, seed) {
  const { ns, counts } = frequencyRuns(p, N, seed);
  const lx = ns.map((n) => Math.log10(n)), lN = Math.log10(N);
  const finals = counts.map((row) => row.at(-1) / N);
  const half = band3(p, N);
  const inside = finals.filter((f) => Math.abs(f - p) <= half).length;
  return {
    readouts: [
      { key: 'final', label: `Relative frequency after n = ${N}, first sequence`, observed: r6(finals[0]), theory: r6(p),
        convention: `${counts[0].at(-1)} hits of ${N}` },
      { key: 'band', label: 'Predeclared band p ± 3√(p(1 − p)/n)', observed: `${inside} of ${PATHS} inside`, theory: `± ${fmt(half)}` },
      { key: 'spread', label: `Spread of the ${PATHS} final frequencies`, observed: r6(Math.max(...finals) - Math.min(...finals)),
        theory: `≈ ${fmt(Math.sqrt((p * (1 - p)) / N))} per sequence`, convention: 'falls like 1/√n' },
    ],
    series: [
      { id: 'band', kind: 'band', tone: 'signal', label: 'p ± 3√(p(1 − p)/n)', x: lx,
        y: ns.map((n) => Math.max(0, p - band3(p, n))), y2: ns.map((n) => Math.min(1, p + band3(p, n))) },
      { id: 'p', kind: 'line', tone: 'signal', label: `p = ${p}`, x: [0, lN], y: [p, p] },
      ...counts.map((row, j) => ({ id: 'path' + j, kind: 'line', tone: j === 0 ? 'accent' : 'default',
        label: j === 0 ? `relative frequency m/n, ${PATHS} sequences` : undefined, x: lx, y: row.map((c, k) => c / ns[k]) })),
    ],
    axes: { x: 'log₁₀ n (n = 10, 100, 1000 at 1, 2, 3)', y: 'relative frequency m/n' },
    notes: [
      'Statistical definition (L1): the probability of an event is the number near which its relative frequency m/n settles in long series of trials.',
      'Early on the frequency swings widely; its typical distance from p shrinks like 1/√n, which is why the band narrows. Bernoulli\'s theorem (L7) proves this.',
    ],
  };
}

// ---------------------------------------------------------------- Darts station (L1, L4: geometric method)
const SHOW = 1500; // points drawn on the picture; the counts use all N
/** L1 example 1: x ~ U(0, π); y = √(0.5 − sin²x) exists when sin²x ≤ 1/2, i.e. x ∈ [0, π/4] ∪ [3π/4, π]: P = 1/2. */
export const sinHit = (x) => Math.sin(x) ** 2 <= 0.5;
/** A region in [0, 1]²: the quarter disc x² + y² ≤ 1, measure π/4. */
export const discHit = (x, y) => x * x + y * y <= 1;
/** The Bertrand chord schemes in the unit circle; a chord is long when it exceeds the inscribed triangle's side √3. */
export const BERTRAND = Object.freeze([
  { id: 'radius', label: 'random point on a radius', exact: 1 / 2,
    long: (u, _v) => u < 0.5 }, // distance from the centre d = u; chord 2√(1 − d²) > √3 ⇔ d < 1/2
  { id: 'endpoints', label: 'random endpoints', exact: 1 / 3,
    long: (u, _v) => { const t = 2 * Math.PI * u; return 2 * Math.sin(t / 2) > Math.sqrt(3); } }, // central angle t
  { id: 'midpoint', label: 'random midpoint in the disc', exact: 1 / 4,
    long: (u, _v) => Math.sqrt(u) < 0.5 }, // midpoint radius r = √u is uniform over the disc's area
]);

function runDarts({ view, N }, seed) {
  if (view === 2) {
    const ns = checkpoints(N), lx = ns.map((n) => Math.log10(n)), lN = Math.log10(N);
    const rows = BERTRAND.map((s, j) => {
      let c = 0, k = 0;
      const y = [];
      for (let i = 1; i <= N; i++) {
        if (s.long(uni(seed, 40 + j, i), 0)) c++;
        if (i === ns[k]) { y.push(c / i); k++; }
      }
      return { s, y, count: c };
    });
    return {
      readouts: rows.map(({ s, count }) => ({ key: s.id, label: `Long chords, ${s.label}`, observed: r6(count / N), theory: r6(s.exact),
        convention: `± ${fmt(band3(s.exact, N))} (3 SE); ${Math.abs(count / N - s.exact) <= band3(s.exact, N) ? 'inside' : 'outside'}` })),
      series: [
        ...rows.map(({ s }) => ({ id: 'exact-' + s.id, kind: 'line', tone: 'signal', label: undefined, x: [0, lN], y: [s.exact, s.exact] })),
        ...rows.map(({ s, y }, j) => ({ id: 'freq-' + s.id, kind: 'line', tone: j === 0 ? 'accent' : j === 1 ? 'default' : 'muted',
          label: `${s.label} → ${['1/2', '1/3', '1/4'][j]}`, x: lx, y })),
      ],
      axes: { x: 'log₁₀ n, chords drawn', y: 'share of chords longer than √3' },
      notes: [
        'Bertrand (L1, example 2): "a chord taken at random" is not defined until we say how. Three natural ways give three different answers: 1/2, 1/3 and 1/4.',
        'Each answer is correct for its own experiment; the simulation confirms all three. None of them is "the" answer: the lecture\'s choice of 0.5 (the largest) is a convention, not a theorem.',
      ],
    };
  }
  const hitX = [], hitY = [], missX = [], missY = [];
  let hits = 0;
  const exact = view === 0 ? 0.5 : Math.PI / 4;
  for (let i = 0; i < N; i++) {
    const u = uni(seed, 30, i), v = uni(seed, 31, i);
    let hit, px, py;
    if (view === 0) { px = Math.PI * u; py = 0.5 - Math.sin(px) ** 2; hit = sinHit(px); py += (v - 0.5) * 0.08; }
    else { px = u; py = v; hit = discHit(u, v); }
    if (hit) hits++;
    if (i < SHOW) (hit ? (hitX.push(px), hitY.push(py)) : (missX.push(px), missY.push(py)));
  }
  const half = band3(exact, N);
  const freq = hits / N;
  const readouts = [
    { key: 'freq', label: view === 0 ? 'Share of x with sin²x ≤ 1/2' : 'Share of points with x² + y² ≤ 1', observed: r6(freq), theory: r6(exact),
      convention: `± ${fmt(half)} (3 SE); ${Math.abs(freq - exact) <= half ? 'inside' : 'outside'} the band` },
    { key: 'measure', label: 'Exact measure ratio mes A / mes D', observed: null, theory: view === 0 ? '(π/4 + π/4) / π = 1/2' : '(π/4) / 1 ≈ 0.7854' },
  ];
  if (view === 1) readouts.push({ key: 'pi', label: 'Estimate of π = 4 · share', observed: r6(4 * freq), theory: r6(Math.PI), convention: `± ${fmt(4 * half)}` });
  const fine = view === 0 ? grid(0, Math.PI, 181) : grid(0, 1, 101);
  return {
    readouts,
    series: view === 0 ? [
      { id: 'curve', kind: 'line', tone: 'signal', label: 'y = 0.5 − sin²x (y exists where it is ≥ 0)', x: fine, y: fine.map((x) => 0.5 - Math.sin(x) ** 2) },
      { id: 'zero', kind: 'line', tone: 'muted', x: [0, Math.PI], y: [0, 0] },
      { id: 'hits', kind: 'points', tone: 'accent', label: `hits (first ${Math.min(N, SHOW)} throws)`, x: hitX, y: hitY },
      { id: 'misses', kind: 'points', tone: 'muted', label: 'misses', x: missX, y: missY },
    ] : [
      { id: 'hits', kind: 'points', tone: 'accent', label: `inside (first ${Math.min(N, SHOW)} throws)`, x: hitX, y: hitY },
      { id: 'misses', kind: 'points', tone: 'muted', label: 'outside', x: missX, y: missY },
      { id: 'arc', kind: 'line', tone: 'signal', label: 'x² + y² = 1', x: fine, y: fine.map((x) => Math.sqrt(Math.max(0, 1 - x * x))) },
    ],
    axes: view === 0 ? { x: 'x, thrown uniformly on [0, π]', y: '0.5 − sin²x (points jittered)' } : { x: 'x', y: 'y' },
    notes: view === 0
      ? ['Geometric method (L1, L4): a point thrown at random into D lands in A with probability mes A / mes D.',
        'L1 example 1: √(0.5 − sin²x) exists when sin²x ≤ 1/2, that is on [0, π/4] and [3π/4, π]. Half of [0, π], so P = 1/2.']
      : ['A point thrown at random into the unit square lands in the quarter disc with probability equal to its area, π/4.',
        'So the hit share times 4 estimates π: the Monte Carlo idea in one picture. The error shrinks like 1/√n.'],
  };
}

// ---------------------------------------------------------------- contract
const stationParams = {
  frequency: [
    { key: 'p', label: 'Probability of the event p', min: 0.05, max: 0.95, step: 0.05, default: 0.5 },
    { key: 'N', label: 'Trials N', min: 100, max: 20000, step: 100, default: 2000 },
  ],
  darts: [
    { key: 'view', label: 'View (0 sin² example, 1 quarter disc, 2 Bertrand chords)', min: 0, max: 2, step: 1, default: 2 },
    { key: 'N', label: 'Throws N', min: 100, max: 20000, step: 100, default: 4000 },
  ],
};
export const stations = Object.freeze({
  frequency: { params: stationParams.frequency, live: true },
  darts: { params: stationParams.darts, live: true },
});
export const meta = {
  id: 'lecture-geometric-probability',
  lectures: ['L1', 'L4'],
  title: 'Relative frequency, the geometric method and the Bertrand paradox',
  params: stationParams.darts,
};

export function run(params, { seed, station = 'darts' } = {}) {
  if (station === 'frequency') return runFrequency(params, seed);
  return runDarts(params, seed);
}
