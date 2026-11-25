// Lecture kernel for L1 and L4: the statistical definition of probability (Frequency) and the
// geometric method with the sin² example, a region in the unit square and the Bertrand paradox (Darts).
// Pure ES module: no DOM. Randomness only from fixtureUint32 (fixture-mix32-v1).
// Contract: docs/research/lecture-module-map.md; research: docs/research/lecture-geometric-probability.md.
import { fixtureUint32 } from '../simulation-engine/engine.mjs';
import { RegionError, compileRegion, parseRegion, regionArea, regionDim, regionIntervals, regionLength, regionRuns, regionTex, regionVolume } from './region.mjs';

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
      { key: 'final', label: `Relative frequency after $n = ${N}$, first sequence`, observed: r6(finals[0]), theory: r6(p),
        convention: `${counts[0].at(-1)} hits of ${N}` },
      { key: 'band', label: 'Predeclared band $p \\pm 3\\sqrt{p(1-p)/n}$', observed: `${inside} of ${PATHS} inside`, theory: `± ${fmt(half)}` },
      { key: 'spread', label: `Spread of the ${PATHS} final frequencies`, observed: r6(Math.max(...finals) - Math.min(...finals)),
        theory: `$\\approx ${fmt(Math.sqrt((p * (1 - p)) / N))}$ per sequence`, convention: 'falls like $1/\\sqrt{n}$' },
    ],
    series: [
      { id: 'band', kind: 'band', tone: 'signal', label: '$p \\pm 3\\sqrt{p(1-p)/n}$', x: lx,
        y: ns.map((n) => Math.max(0, p - band3(p, n))), y2: ns.map((n) => Math.min(1, p + band3(p, n))) },
      { id: 'p', kind: 'line', tone: 'signal', label: `$p = ${p}$`, x: [0, lN], y: [p, p] },
      ...counts.map((row, j) => ({ id: 'path' + j, kind: 'line', tone: j === 0 ? 'accent' : 'default',
        label: j === 0 ? `relative frequency $m/n$, ${PATHS} sequences` : undefined, x: lx, y: row.map((c, k) => c / ns[k]) })),
    ],
    axes: { x: '$\\lg n$ ($n = 10, 100, 1000$ at 1, 2, 3)', y: 'relative frequency $m/n$' },
    notes: [
      'Statistical definition (L1): the probability of an event is the number near which its relative frequency $m/n$ settles in long series of trials.',
      'Early on the frequency swings widely; its typical distance from $p$ shrinks like $1/\\sqrt{n}$, which is why the band narrows. Bernoulli\'s theorem (L7) proves this.',
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

// #124: the chords themselves. Each method turns its draw u (stream 40 + j, the one the counts use) and an angle
// φ = 2π·v (stream 60 + j, which only turns the picture) into a chord of the unit circle, [x1, y1, x2, y2].
export const CHORDS_SHOWN = 36;
export function bertrandChord(id, u, phi) {
  const at = (a) => [Math.cos(a), Math.sin(a)];
  if (id === 'endpoints') return [...at(phi), ...at(phi + 2 * Math.PI * u)]; // two points on the circle, central angle 2πu
  const dist = id === 'radius' ? u : Math.sqrt(u); // distance of the chord from the centre
  const half = Math.acos(Math.min(1, dist)); // the chord ⟂ the radius at φ, at that distance
  return [...at(phi - half), ...at(phi + half)];
}
const FORMULA_124 = {
  radius: (c) => `\\text{a point on a radius: } P = \\tfrac12, \\quad \\tfrac{m}{n} = ${c}`,
  endpoints: (c) => `\\text{random endpoints: } P = \\tfrac13, \\quad \\tfrac{m}{n} = ${c}`,
  midpoint: (c) => `\\text{a midpoint in the disc: } P = \\tfrac14, \\quad \\tfrac{m}{n} = ${c}`,
};

function runDarts({ view, N, l, d, dim = 2, region, region1, region3 }, seed) {
  if (view === 3) return runBuffon({ N, l, d }, seed);
  if (view === 4) {
    const D = dim === 1 || dim === 3 ? dim : 2;
    return runRegion({ N, dim: D, region: (D === 1 ? region1 : D === 3 ? region3 : region) ?? DEFAULT_REGIONS[D] }, seed);
  }
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
    const circles = BERTRAND.map((s, j) => {
      const chords = [], long = [];
      for (let i = 1; i <= Math.min(N, CHORDS_SHOWN); i++) {
        const u = uni(seed, 40 + j, i);
        chords.push(bertrandChord(s.id, u, 2 * Math.PI * uni(seed, 60 + j, i)).map(r6));
        long.push(s.long(u, 0));
      }
      return { id: s.id, label: s.label, exact: s.exact, share: r6(rows[j].count / N), chords, long };
    });
    return {
      board: { kind: 'chords', circles },
      formula: rows.map(({ s, count }) => FORMULA_124[s.id](String(Number((count / N).toPrecision(4))))),
      readouts: rows.map(({ s, count }) => ({ key: s.id, label: `Long chords, ${s.label}`, observed: r6(count / N), theory: r6(s.exact),
        convention: `± ${fmt(band3(s.exact, N))} (3 SE); ${Math.abs(count / N - s.exact) <= band3(s.exact, N) ? 'inside' : 'outside'}` })),
      series: [
        ...rows.map(({ s }) => ({ id: 'exact-' + s.id, kind: 'line', tone: 'signal', label: undefined, x: [0, lN], y: [s.exact, s.exact] })),
        ...rows.map(({ s, y }, j) => ({ id: 'freq-' + s.id, kind: 'line', tone: j === 0 ? 'accent' : j === 1 ? 'default' : 'muted',
          label: `${s.label} $\\to ${['\\tfrac12', '\\tfrac13', '\\tfrac14'][j]}$`, x: lx, y })),
      ],
      axes: { x: '$\\lg n$, chords drawn', y: 'share of chords longer than $\\sqrt{3}$' },
      notes: [
        'Bertrand (L1, example 2): "a chord taken at random" is not defined until we say how. Three natural ways give three different answers: $\\tfrac12$, $\\tfrac13$ and $\\tfrac14$.',
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
    { key: 'freq', label: view === 0 ? 'Share of $x$ with $\\sin^2 x \\le \\tfrac12$' : 'Share of points with $x^2 + y^2 \\le 1$', observed: r6(freq), theory: r6(exact),
      convention: `± ${fmt(half)} (3 SE); ${Math.abs(freq - exact) <= half ? 'inside' : 'outside'} the band` },
    { key: 'measure', label: 'Exact measure ratio $\\operatorname{mes} A / \\operatorname{mes} D$', observed: null, theory: view === 0 ? '$\\dfrac{\\pi/4 + \\pi/4}{\\pi} = \\dfrac12$' : '$\\dfrac{\\pi/4}{1} \\approx 0.7854$' },
  ];
  // #128: no approximation here; the exact measure ratio and the share of hits.
  const meet = {
    label: view === 0 ? '$P(\\sin^2 x \\le \\tfrac12)$' : '$P(x^2 + y^2 \\le 1)$',
    exact: { value: r6(exact), label: view === 0 ? 'exact, $\\tfrac12$' : 'exact, $\\pi/4$', series: view === 0 ? 'curve' : 'arc' },
    sim: { value: r6(freq), label: `share of $n = ${N}$ throws`, series: 'hits' },
  };
  if (view === 1) readouts.push({ key: 'pi', label: 'Estimate of $\\pi = 4 \\cdot \\text{share}$', observed: r6(4 * freq), theory: r6(Math.PI), convention: `± ${fmt(4 * half)}` });
  const fine = view === 0 ? grid(0, Math.PI, 181) : grid(0, 1, 101);
  return {
    readouts,
    meet,
    series: view === 0 ? [
      { id: 'curve', kind: 'line', tone: 'signal', label: '$y = 0.5 - \\sin^2 x$ ($\\sqrt{y}$ exists where $y \\ge 0$)', x: fine, y: fine.map((x) => 0.5 - Math.sin(x) ** 2) },
      { id: 'zero', kind: 'line', tone: 'muted', x: [0, Math.PI], y: [0, 0] },
      { id: 'hits', kind: 'points', tone: 'accent', label: `hits (first ${Math.min(N, SHOW)} throws)`, x: hitX, y: hitY },
      { id: 'misses', kind: 'points', tone: 'muted', label: 'misses', x: missX, y: missY },
    ] : [
      { id: 'hits', kind: 'points', tone: 'accent', label: `inside (first ${Math.min(N, SHOW)} throws)`, x: hitX, y: hitY },
      { id: 'misses', kind: 'points', tone: 'muted', label: 'outside', x: missX, y: missY },
      { id: 'arc', kind: 'line', tone: 'signal', label: '$x^2 + y^2 = 1$', x: fine, y: fine.map((x) => Math.sqrt(Math.max(0, 1 - x * x))) },
    ],
    axes: view === 0 ? { x: '$x$, thrown uniformly on $[0, \\pi]$', y: '$0.5 - \\sin^2 x$ (points jittered)' } : { x: 'x', y: 'y' },
    notes: view === 0
      ? ['Geometric method (L1, L4): a point thrown at random into $D$ lands in $A$ with probability $\\operatorname{mes} A / \\operatorname{mes} D$.',
        'L1 example 1: $\\sqrt{0.5 - \\sin^2 x}$ exists when $\\sin^2 x \\le \\tfrac12$, that is on $[0, \\pi/4]$ and $[3\\pi/4, \\pi]$. Half of $[0, \\pi]$, so $P = \\tfrac12$.']
      : ['A point thrown at random into the unit square lands in the quarter disc with probability equal to its area, $\\pi/4$.',
        'So the hit share times 4 estimates $\\pi$: the Monte Carlo idea in one picture. The error shrinks like $1/\\sqrt{n}$.'],
  };
}

// ---------------------------------------------------------------- Buffon's needle (#90)
export const NEEDLES = 80; // needles drawn on the board; the counts use all N
export const BOARD = Object.freeze({ strips: 4, width: 6 }); // the board: 4 strips of height d, 6d wide
/** P(a needle of length l crosses a line) for lines d apart, l ≤ d: 2l/(πd). */
export const buffonP = (l, d) => (2 * l) / (Math.PI * d);
/**
 * Needle i: its centre lies at `off` = d·u (stream 50) above the line below it, at angle θ = π·v (stream 51) to the
 * lines; it crosses a line when the nearer line is within its half-projection: min(off, d − off) ≤ (l/2)·sin θ.
 * Streams 52 and 53 only place the needle on the board (column and strip), so the picture shows the counted needles.
 */
export function buffonNeedle(seed, i, l, d) {
  const off = d * uni(seed, 50, i), theta = Math.PI * uni(seed, 51, i);
  const hit = Math.min(off, d - off) <= (l / 2) * Math.sin(theta);
  return { off, theta, hit };
}

function runBuffon({ N, l: lTyped, d }, seed) {
  const l = Math.min(lTyped, d);
  const p = buffonP(l, d);
  const ns = checkpoints(N), lN = Math.log10(N);
  const est = [], estX = [], needles = [], hits = [];
  let m = 0, k = 0;
  for (let i = 1; i <= N; i++) {
    const nd = buffonNeedle(seed, i, l, d);
    if (nd.hit) m++;
    if (i <= NEEDLES) {
      const strip = Math.floor(BOARD.strips * uni(seed, 53, i));
      needles.push([r6(BOARD.width * d * uni(seed, 52, i)), r6(strip * d + nd.off), r6(nd.theta)]);
      hits.push(nd.hit);
    }
    if (i === ns[k]) {
      if (m > 0) { estX.push(Math.log10(i)); est.push((2 * l * i) / (d * m)); }
      k++;
    }
  }
  const se = (n) => Math.PI * Math.sqrt((1 - p) / (n * p)); // delta method: sd of 2l/(d·m/n) around π
  const piHat = m > 0 ? (2 * l * N) / (d * m) : null;
  const half = 3 * se(N);
  const notes = [
    "Buffon's needle (L4): a needle of length $l$ dropped at random on lines $d$ apart crosses one with probability $P = \\dfrac{2l}{\\pi d}$. The position of its centre and its angle are uniform, so $P$ is the area under $\\tfrac{l}{2}\\sin\\theta$ over the rectangle $[0, \\pi] \\times [0, \\tfrac{d}{2}]$.",
    'Turn it round: the share of crossings $m/n$ estimates $P$, so $\\hat\\pi = \\dfrac{2ln}{dm}$ estimates $\\pi$. Its error shrinks like $1/\\sqrt{n}$: about 100 times more needles for each new correct digit.',
  ];
  if (lTyped > d) notes.unshift(`The needle is longer than the spacing ($l = ${lTyped} > d = ${d}$); the formula needs $l \\le d$, so the needle is cut to $l = d = ${d}$.`);
  const fmtN = (v) => String(Number(v.toPrecision(5)));
  return {
    readouts: [
      { key: 'pi', label: 'Estimate $\\hat\\pi = \\dfrac{2ln}{dm}$', observed: r6(piHat), theory: r6(Math.PI),
        convention: `± ${fmt(half)} (3 SE); ${piHat != null && Math.abs(piHat - Math.PI) <= half ? 'inside' : 'outside'} the band` },
      { key: 'cross', label: 'Share of needles crossing a line $m/n$', observed: r6(m / N), theory: r6(p), convention: `$P = \\dfrac{2l}{\\pi d}$, ${m} of ${N} needles` },
      { key: 'digits', label: 'Correct digits of $\\pi$', observed: piHat == null ? null : Math.max(0, Math.floor(-Math.log10(Math.abs(piHat - Math.PI) / Math.PI))), theory: null,
        convention: 'one more digit needs about 100 times more needles' },
    ],
    series: [
      { id: 'band', kind: 'band', tone: 'signal', label: '$\\pi \\pm 3\\,\\mathrm{SE}$', x: ns.map((n) => Math.log10(n)),
        y: ns.map((n) => Math.PI - 3 * se(n)), y2: ns.map((n) => Math.PI + 3 * se(n)) },
      { id: 'pi', kind: 'line', tone: 'signal', label: '$\\pi$', x: [0, lN], y: [Math.PI, Math.PI] },
      { id: 'estimate', kind: 'line', tone: 'accent', label: '$\\hat\\pi$ after $n$ needles', x: estX, y: est },
    ],
    axes: { x: '$\\lg n$, needles dropped', y: '$\\hat\\pi = 2ln/(dm)$' },
    domain: { x: [0, lN], y: [Math.PI - 1, Math.PI + 1] },
    formula: [
      `P = \\dfrac{2l}{\\pi d} = \\dfrac{2 \\cdot ${l}}{\\pi \\cdot ${d}} = ${fmtN(p)}`,
      piHat == null ? `\\hat\\pi = \\dfrac{2ln}{dm}, \\quad m = 0`
        : `\\hat\\pi = \\dfrac{2ln}{dm} = \\dfrac{2 \\cdot ${l} \\cdot ${N}}{${d} \\cdot ${m}} = ${fmtN(piHat)}`,
    ],
    board: { kind: 'needles', d, l, strips: BOARD.strips, width: BOARD.width * d, needles, hits },
    notes,
  };
}

// ---------------------------------------------------------------- a typed region (#90), on a segment, square or cube (#119)
export const DEFAULT_REGION = 'y < x^2';
export const DEFAULT_REGIONS = Object.freeze({ 1: 'x^2 < 0.5', 2: DEFAULT_REGION, 3: 'x^2 + y^2 + z^2 < 1' });
export const DARTS = 400; // darts drawn on the board; the counts use all N
export const DARTS_3D = 1200; // in the cube the hits themselves draw the shape, so more of them are shown
export const AREA_GRID = 1000;
/** A small error written plainly: 0.0021, 3e-6 as 3·10⁻⁶ in TeX. */
const errText = (e) => (e >= 1e-4 ? String(Number(e.toPrecision(2))) : `$${Number(e.toPrecision(1)).toExponential().replace(/e([-+]\d+)/, (_, p) => ` \\cdot 10^{${Number(p)}}`)}$`);
const TEXT_DIM = Object.freeze({ region1: 1, region: 2, region3: 3 });
const SPACE = Object.freeze({
  1: { set: '[0, 1]', mes: 'length', grid: (G) => `a grid of ${G} cells` },
  2: { set: '[0, 1]^2', mes: 'area', grid: (G) => `a ${G} × ${G} grid` },
  3: { set: '[0, 1]^3', mes: 'volume', grid: (G) => `a ${G} × ${G} × ${G} grid` },
});
const regions = new Map();
/** The region typed as text for a space of `dim` dimensions, parsed, compiled and measured once. Throws a RegionError. */
export function prepareRegion(text, dim = 2) {
  const key = `${dim}|${String(text ?? '').trim()}`;
  let r = regions.get(key);
  if (!r) {
    const tree = parseRegion(String(text ?? '').trim());
    if (regionDim(tree) > dim)
      throw dim === 1 ? new RegionError('On the segment use x only: y and z need the square or the cube.')
        : new RegionError('In the square use x and y only: z needs the cube.');
    const inside = compileRegion(tree);
    const measure = dim === 1 ? regionLength(inside) : dim === 3 ? regionVolume(inside) : regionArea(inside, AREA_GRID);
    const shape = dim === 1 ? { intervals: regionIntervals(inside).map((q) => q.map(r6)) } : dim === 2 ? { runs: regionRuns(inside).map((q) => q.map(r6)) } : {};
    r = { inside, tex: regionTex(tree), ...measure, ...shape };
    if (regions.size > 64) regions.clear();
    regions.set(key, r);
  }
  return r;
}
/** Checks a typed text parameter before the host sends it: null when valid, else the error with its template. */
export function checkText(station, key, value) {
  if (station !== 'darts' || !(key in TEXT_DIM)) return null;
  try {
    prepareRegion(value, TEXT_DIM[key]);
    return null;
  } catch (e) {
    if (e instanceof RegionError) return { message: e.message, template: e.template, values: e.values };
    return { message: String(e?.message ?? e), template: String(e?.message ?? e), values: [] };
  }
}

/**
 * Points thrown uniformly into the segment, square or cube; the share of hits settles at mes A. Coordinates come from
 * streams 30, 31, 32 (x, y, z), so the square's darts are those of #90 and the same seed gives the same hits.
 */
function runRegion({ N, dim, region }, seed) {
  const R = prepareRegion(region, dim), sp = SPACE[dim];
  const ns = checkpoints(N), lN = Math.log10(N);
  const shown = dim === 3 ? DARTS_3D : DARTS;
  const freq = [], darts = [], hits = [];
  let m = 0, k = 0;
  for (let i = 1; i <= N; i++) {
    const x = uni(seed, 30, i), y = dim > 1 ? uni(seed, 31, i) : 0, z = dim > 2 ? uni(seed, 32, i) : 0;
    const hit = R.inside(x, y, z);
    if (hit) m++;
    if (i <= shown) {
      // On the segment the second coordinate only spreads the marks over the strip (stream 33); it is not counted.
      darts.push(dim === 1 ? [r6(x), r6(uni(seed, 33, i))] : dim === 2 ? [r6(x), r6(y)] : [r6(x), r6(y), r6(z)]);
      hits.push(hit);
    }
    if (i === ns[k]) { freq.push(m / i); k++; }
  }
  const a = R.area, half = band3(a, N), share = m / N;
  const fmtN = (v) => String(Number(v.toPrecision(4)));
  const noun = { 1: 'point', 2: 'dart', 3: 'point' }[dim];
  const notes = [
    dim === 1 ? 'Geometric method (L4): a point thrown at random into $[0, 1]$ lands in $A$ with probability $\\operatorname{mes} A$, the length of $A$. The share of hits settles at it.'
      : dim === 3 ? 'Geometric method (L4): a point thrown at random into the unit cube lands in $A$ with probability $\\operatorname{mes} A$, the volume of $A$. The share of hits settles at it.'
      : 'Geometric method (L4): a dart thrown at random into the unit square lands in $A$ with probability $\\operatorname{mes} A$, the area of $A$. The share of hits settles at it.',
    `The ${sp.mes} is integrated numerically: the midpoint rule on ${sp.grid(R.grid)}, accurate to about ±${errText(R.error)} (${dim === 2 ? 'half the cells the boundary crosses' : 'the change from a grid twice as coarse'}).`,
  ];
  if (a === 0) notes.unshift(`No point of $${sp.set}$ satisfies the region: it is empty, so nothing can land in it.`);
  else if (a === 1) notes.unshift(`Every point of $${sp.set}$ satisfies the region: everything lands in it.`);
  const board = dim === 1 ? { kind: 'segment', intervals: R.intervals, darts, hits }
    : dim === 3 ? { kind: 'cube', darts, hits }
    : { kind: 'region', runs: R.runs, darts, hits };
  const label = { 1: 'Share of points in $A$, $m/n$', 2: 'Share of darts in $A$, $m/n$', 3: 'Share of points in $A$, $m/n$' }[dim];
  const shareLabel = { 1: 'share of points in $A$', 2: 'share of darts in $A$', 3: 'share of points in $A$' }[dim];
  return {
    readouts: [
      { key: 'share', label, observed: r6(share), theory: r6(a),
        convention: `± ${fmt(half)} (3 SE); ${Math.abs(share - a) <= half + R.error ? 'inside' : 'outside'} the band` },
      { key: 'area', label: { 1: 'Length of $A$, numerically integrated', 2: 'Area of $A$, numerically integrated', 3: 'Volume of $A$, numerically integrated' }[dim],
        observed: null, theory: r6(a), convention: `± ${errText(R.error)} on ${sp.grid(R.grid)}` },
      { key: 'hits', label: { 1: 'Points in $A$', 2: 'Darts in $A$', 3: 'Points in $A$' }[dim], observed: m, theory: r6(a * N), convention: `of $n = ${N}$` },
    ],
    series: [
      { id: 'band', kind: 'band', tone: 'signal', label: '$\\operatorname{mes} A \\pm 3\\sqrt{p(1-p)/n}$', x: ns.map((n) => Math.log10(n)),
        y: ns.map((n) => Math.max(0, a - band3(a, n))), y2: ns.map((n) => Math.min(1, a + band3(a, n))) },
      { id: 'area', kind: 'line', tone: 'signal', label: '$\\operatorname{mes} A$', x: [0, lN], y: [a, a] },
      { id: 'freq', kind: 'line', tone: 'accent', label: shareLabel, x: ns.map((n) => Math.log10(n)), y: freq },
    ],
    axes: { x: `$\\lg n$, ${noun}s thrown`, y: shareLabel },
    domain: { x: [0, lN], y: [0, 1] },
    formula: [
      `A = \\{${dim === 1 ? 'x \\in [0, 1]' : dim === 2 ? '(x, y) \\in [0, 1]^2' : '(x, y, z) \\in [0, 1]^3'} : ${R.tex}\\}`,
      `P = \\dfrac{\\operatorname{mes} A}{\\operatorname{mes} ${sp.set === '[0, 1]' ? '[0, 1]' : `[0, 1]^${dim}`}} = ${fmtN(a)}, \\quad \\dfrac{m}{n} = \\dfrac{${m}}{${N}} = ${fmtN(share)}`,
    ],
    board,
    notes,
    meet: {
      label: '$P = \\operatorname{mes} A / \\operatorname{mes} G$',
      exact: { value: r6(a), label: `quadrature, $\\pm ${R.error >= 1e-4 ? Number(R.error.toPrecision(2)) : '10^{-4}'}$`, series: 'area' },
      sim: { value: r6(share), label: `share of $n = ${N}$ throws`, series: 'freq' },
    },
  };
}

// ---------------------------------------------------------------- contract
const stationParams = {
  frequency: [
    { key: 'p', label: 'Probability of the event $p$', min: 0.05, max: 0.95, step: 0.05, default: 0.5 },
    { key: 'N', label: 'Trials $N$', min: 100, max: 20000, step: 100, default: 2000 },
  ],
  darts: [
    { key: 'view', label: "View (0 $\\sin^2$ example, 1 quarter disc, 2 Bertrand chords, 3 Buffon's needle, 4 your region)", min: 0, max: 4, step: 1, default: 2 },
    { key: 'dim', label: 'Space (1 segment, 2 square, 3 cube)', min: 1, max: 3, step: 1, default: 2, when: { view: [4] } },
    { key: 'N', label: 'Throws $N$', min: 100, max: 20000, step: 100, default: 4000 },
    { key: 'l', label: 'Needle length $l$', min: 0.1, max: 2, step: 0.05, default: 0.8, when: { view: [3] } },
    { key: 'd', label: 'Line spacing $d$', min: 0.2, max: 2, step: 0.1, default: 1, when: { view: [3] } },
  ],
};
export const stations = Object.freeze({
  frequency: { params: stationParams.frequency, live: true },
  darts: { params: stationParams.darts, live: true, texts: [
    { key: 'region', label: 'Region $A$ in the unit square', default: DEFAULT_REGION, when: { view: [4], dim: [2] },
      presets: ['y < x^2', 'x^2 + y^2 < 1', '|x - 0.5| + |y - 0.5| < 0.4', 'y < sin(pi x)', 'y > x and y < 2x', '0.2 < x < 0.8 or y > 0.9'] },
    { key: 'region1', label: 'Region $A$ in the segment $[0, 1]$', default: DEFAULT_REGIONS[1], when: { view: [4], dim: [1] },
      presets: ['x^2 < 0.5', '|x - 0.5| < 0.2', 'sin(2 pi x) > 0', 'x < 0.3 or x > 0.9', 'sin(10 x)^2 < 0.5'] },
    { key: 'region3', label: 'Region $A$ in the unit cube', default: DEFAULT_REGIONS[3], when: { view: [4], dim: [3] },
      presets: ['x^2 + y^2 + z^2 < 1', 'x + y + z < 1', 'z < x y', 'x^2 + y^2 < z^2', '(x - 0.5)^2 + (y - 0.5)^2 < 0.1 and z < 0.7'] },
  ] },
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
