// #121: the characteristic function φ(t) = M e^{itX} on the complex plane (L9).
// Each sampled value x_j is a unit vector e^{itx_j}; their mean is the empirical φ(t). Pure ES module: no DOM.
// Randomness only from fixtureUint32, through the `uni` passed in by the kernel.

/** Complex numbers as [re, im]. */
const cmul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const cexp = ([a, b]) => { const r = Math.exp(a); return [r * Math.cos(b), r * Math.sin(b)]; };
const cpow = (z, m) => { let out = [1, 0]; for (let k = 0; k < m; k++) out = cmul(out, z); return out; };

/** The six laws of #121 with their exact characteristic functions and samplers. `q` holds p, m, lambda, a, s. */
export const CF_LAWS = Object.freeze([
  { id: 'bernoulli', label: 'Bernoulli', tex: (q) => `1 - p + p\\,e^{it}`, symmetric: () => false,
    phi: (t, q) => [1 - q.p + q.p * Math.cos(t), q.p * Math.sin(t)],
    draw: (u, i, q) => (u(0, i) < q.p ? 1 : 0), scale: () => 1, mean: (q) => q.p },
  { id: 'binomial', label: 'binomial', tex: () => `\\left(1 - p + p\\,e^{it}\\right)^{m}`, symmetric: () => false,
    phi: (t, q) => cpow([1 - q.p + q.p * Math.cos(t), q.p * Math.sin(t)], q.m),
    draw: (u, i, q) => { let k = 0; for (let r = 0; r < q.m; r++) if (u(1 + r, i) < q.p) k++; return k; }, scale: () => 1, mean: (q) => q.m * q.p },
  { id: 'poisson', label: 'Poisson', tex: () => `e^{\\lambda\\left(e^{it} - 1\\right)}`, symmetric: () => false,
    phi: (t, q) => cexp([q.lambda * (Math.cos(t) - 1), q.lambda * Math.sin(t)]),
    draw: (u, i, q) => { let x = 0, pk = Math.exp(-q.lambda), c = pk; const v = u(0, i); while (v > c && x < 200) { x++; pk *= q.lambda / x; c += pk; } return x; },
    scale: () => 1, mean: (q) => q.lambda },
  { id: 'uniform', label: 'uniform', tex: () => `e^{ita}\\,\\dfrac{\\sin ts}{ts}`, symmetric: (q) => q.a === 0,
    phi: (t, q) => { const r = Math.abs(t * q.s) < 1e-12 ? 1 : Math.sin(t * q.s) / (t * q.s); return [r * Math.cos(t * q.a), r * Math.sin(t * q.a)]; },
    draw: (u, i, q) => q.a - q.s + 2 * q.s * u(0, i), scale: (q) => q.s, mean: (q) => q.a },
  { id: 'normal', label: 'normal', tex: () => `e^{ita - s^2 t^2 / 2}`, symmetric: (q) => q.a === 0,
    phi: (t, q) => cexp([-(q.s * q.s * t * t) / 2, t * q.a]),
    draw: (u, i, q) => q.a + q.s * Math.sqrt(-2 * Math.log(u(0, i))) * Math.cos(2 * Math.PI * u(1, i)), scale: (q) => q.s, mean: (q) => q.a },
  { id: 'exponential', label: 'exponential', tex: () => `\\dfrac{\\lambda}{\\lambda - it}`, symmetric: () => false,
    phi: (t, q) => { const d = q.lambda * q.lambda + t * t; return [(q.lambda * q.lambda) / d, (q.lambda * t) / d]; },
    draw: (u, i, q) => -Math.log(u(0, i)) / q.lambda, scale: (q) => 1 / q.lambda, mean: (q) => 1 / q.lambda },
]);

/** The t range shown: integer laws repeat with period 2π; continuous ones spread over a few units of 1/scale. */
export const tRange = (law, q) => (law.id === 'bernoulli' || law.id === 'binomial' || law.id === 'poisson' ? Math.PI * 2 : Math.min(20, 6 / law.scale(q)));

/** The empirical characteristic function of `xs` at t: the mean of the unit vectors e^{itx}. */
export function empiricalPhi(xs, t) {
  let re = 0, im = 0;
  for (const x of xs) { re += Math.cos(t * x); im += Math.sin(t * x); }
  return [re / xs.length, im / xs.length];
}
